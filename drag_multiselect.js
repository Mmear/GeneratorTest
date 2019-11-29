function main(i) {
  // converts pointer events on `dragstart`, `dragging` and `drop`
  i = makeDragMessages(i);
  // converts pointer events into `select`,
  // `selecting` and `selected` messages
  i = makeSelectMessages(i);
  // highlights selected elements
  i = selectMark(i);
  // if user drags some selected item same messages is duplicated for
  // all other selected items
  i = propagateSelection(i);
  // updates current element absolute position
  i = byElement(setPosition, i);
  return i;
}

async function* makeDragMessages(input) {
  const source = share(input);
  for await (const i of source) {
    if (i.type === "pointerdown") {
      const element = i.target.closest(".draggable");
      if (element) {
        i.preventDefault();
        yield { type: "dragstart", element, x: i.x, y: i.y, event: i };
        for await (const j of source) {
          if (j.type === "pointerup" || j.type === "pointermove") {
            j.preventDefault();
            const dragging = j.type === "pointermove";
            yield {
              type: dragging ? "dragging" : "drop",
              element,
              x: j.x,
              y: j.y,
              event: j
            };
            if (!dragging) break;
          }
          yield j;
        }
        continue;
      }
    }
    yield i;
  }
}

async function* makeSelectMessages(input) {
  const source = share(input);
  for await (const i of source) {
    yield i;
    if (i.type === "pointerdown") {
      i.preventDefault();
      yield { type: "selectstart", x: i.x, y: i.y };
      for await (const j of source) {
        yield j;
        if (j.type === "pointerup" || j.type === "pointermove") {
          j.preventDefault();
          yield {
            type: j.type === "pointerup" ? "select" : "selecting",
            left: Math.min(i.x, j.x),
            top: Math.min(i.y, j.y),
            right: Math.max(i.x, j.x),
            bottom: Math.max(i.y, j.y),
            width: Math.abs(i.x - j.x),
            height: Math.abs(i.y - j.y)
          };
          if (j.type === "pointerup") break;
        }
      }
    }
  }
}

async function* selectMark(input) {
  let selectMark;
  for await (const i of input) {
    yield i;
    switch (i.type) {
      case "select":
      case "selecting":
        if (i.type === "select" && selectMark) {
          selectMark.style.display = "none";
        } else {
          if (!selectMark) {
            selectMark = document.createElement("div");
            selectMark.classList.add("selection");
            document.body.appendChild(selectMark);
          }
          selectMark.style.top = `${i.top + window.pageYOffset}px`;
          selectMark.style.left = `${i.left + window.pageXOffset}px`;
          selectMark.style.width = `${i.width}px`;
          selectMark.style.height = `${i.height}px`;
          selectMark.style.display = "block";
        }
        const items = document.getElementsByClassName("draggable");
        for (const item of items) {
          const itemBox = item.getBoundingClientRect();
          item.classList.toggle(
            "selected",
            itemBox.top > i.top &&
              itemBox.left > i.left &&
              itemBox.bottom < i.bottom &&
              itemBox.right < i.right
          );
        }
        break;
    }
  }
}
/** 针对被选中的元素派发相同事件 */
async function* propagateSelection(input) {
  for await (const i of input) {
    if (i.element && i.element.classList.contains("selected")) {
      for (const j of [...document.getElementsByClassName("selected")])
        yield { ...i, element: j };
    } else yield i;
  }
}
// i = byElement(setPosition, i);
const byElement = (transducer, input) =>
  threadBy(
    i => i.element, // 获取当前执行元素的函数
    gen => stopThread(transducer(gen)), // 传入执行器的函数
    input
  );

async function* stopThread(input) { // 出现终止动作时停止当前"线程"
  for await (const i of input) {
    yield i;
    if (i.type === "drop" || i.type === "dragcancel" || i.type === "remove")
      break;
  }
}

/** 注: 并不是真正的多线程, 只是通过并行多个移动任务来达到同时移动的效果 */
async function* threadBy(select, transducer, input) {
  const threads = new Map(); // [element: thread]键值对存储
  const iter = (async function* source() { // 事件源 Producer, 根据 input 内容分配产生各thread事件交由 main 函数消耗
    for await (const i of input) {
      const key = select(i); // 获取当前元素
      if (!key) {
        yield i;
        continue;
      }
      let thread = threads.get(key); // 获取当前"线程"
      if (!thread) { // 线程未创建, 新建并存入 Map 中
        const q = []; // 每个线程维护一个对列
        let callback;
        const iter = transducer( // 获取任务执行器
          (async function*() {
            for (;;) {
              while (q.length) yield q.shift();
              await new Promise(resolve => (callback = resolve)); // 队列清空后暂停, 等待下一次队列任务触发
              callback = null;
            }
          })()
        )[Symbol.asyncIterator]();
        thread = { // 创建线程, 暴露 send 函数作为任务驱动器
          iter,
          task: iter.next(), // 下一个任务
          key,
          send(i) {
            q.push(i);
            if (callback) callback();
          }
        };
        threads.set(key, thread);
        yield false;
      }
      thread.send(i); // 派发任务
      continue;
    }
  })()[Symbol.asyncIterator]();
  const main = { iter, task: iter.next() };
  for (;;) {
    // 捕捉第一个执行完成当前任务的线程, 终止该线程或者为其分配下一个任务
    const i = await Promise.race( // 没有竞争成功的 promises 会放置到下一轮继续等待
      [main, ...threads.values()].map(i => 
        i.task.then(
          ({ done, value }) => ((i.value = value), (i.done = done), i)
        )
      )
    );
    if (i.done) {
      if (i === main) return i.value; // 主线程执行完毕, 结束
      threads.delete(i.key); // 线程终止, 删除该线程
      continue;
    }
    i.task = i.iter.next(); // 更新任务
    if (i.value) yield i.value;
  }
}

async function* setPosition(input) {
  const source = share(input);
  let z = 0;
  for await (const i of source) {
    yield i;
    if (i.type === "dragstart") {
      const { element } = i;
      const box = element.getBoundingClientRect();
      const x = box.x + window.pageXOffset;
      const y = box.y + window.pageYOffset;
      for await (const j of source) {
        yield j;
        if (j.type === "drop") break;
        if (j.type === "dragging") {
          element.style.left = `${x + j.x - i.x}px`;
          element.style.top = `${y + j.y - i.y}px`;
          element.style.zIndex = z++;
        }
      }
    }
  }
}

let callback;
const queue = [];
function send(event) {
  if (!queue.length && callback) callback();
  queue.push(event);
}

async function* produce() {
  for (;;) {
    while (queue.length) yield queue.shift();
    await new Promise(i => (callback = i));
  }
}

async function consume(input) {
  for await (const i of input) {
  }
}

document.addEventListener("pointermove", send, false);
document.addEventListener("pointerdown", send, false);
document.addEventListener("pointerup", send, false);

function share(iterable) {
  const iterator = iterable[Symbol.asyncIterator]();
  return {
    next(value) {
      return iterator.next();
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}

consume(main(produce()));
