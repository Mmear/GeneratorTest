//INFO AsyncGenerator 的组合思想和 Redux 中间件或者说通用的 Middleware思想如出一辙, 类似洋葱模型
//INFO 逐层递进调用, 再逐层返回

// 将 drag.js 中的 main 函数的逻辑剥离为两部分
function main(i) { 
  // converts pointer events on `dragstart`, `dragging` and `drop`
  i = makeDragMessages(i);
  // updates current element absolute position
  i = setPosition(i);
  return i;
}

async function* makeDragMessages(input) { // 发送事件
  const source = share(input);
  for await (const i of source) {
    if (i.type === "pointerdown") {
      const element = i.target.closest(".draggable");
      if (element) {
        i.preventDefault(); // 阻止鼠标默认事件
        console.log("yield dragstart");
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
            if (!dragging) break; // 会退出当前 forof 循环返回上一步的大 forof 循环
          }
          console.log("yield drag move/up");
          yield j;
        }
        continue;
      }
    }
    console.log("yield i");
    yield i;
  }
}

async function* setPosition(input) { // 具体的处理逻辑, 可看做一个 reducer
  const source = share(input);
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
//TODO 为什么可对 main 函数进行 for await of 遍历?
//因为 main 函数最后返回了执行器 i
async function consume(input) { // 执行器
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
