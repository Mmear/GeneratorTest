function main(i) {
  // converts pointer events on `dragstart`, `dragging` and `drop`
  i = makeDragMessages(i);
  // creates new element if user starts dragging from palette area 当用户从 palette 中开始拖拽时创建一个新元素
  i = palette(i);
  // if its `element` is over ".target" DOM element 判断 element 位置是否在购物车 or 垃圾箱范围内
  i = assignOver(i);
  // generates "remove" message for elements dropped
  // over ".trash" element 当元素被拖到垃圾箱并松开时发出删除命令
  i = trash(i);
  // checks if user dropped an item exactly on some ".target"
  // otherwise generates "dragcancel" message
  i = validateDrop(i);
  // animated return to original "dragstart" position on "dragcancel" 返回原始位置(palette)
  i = flyBack(i);
  // animation for "remove" message
  i = animRemove(i);
  // if canceled drag started not for palette
  // simulates drop to original location 返回原始位置
  i = undoCancel(i); 
  // converts "dragcancel" to "remove" 将取消拖拽变更为删除, 即运行完返回动画后删除 clone 出来的元素
  i = removeCancelled(i);
  // handles "remove" by removing the element from DOM 
  i = applyRemove(i);
  // updates current element absolute position 移动位置
  i = setPosition(i);
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

async function* palette(input) {
  const source = share(input);
  for await (const i of source) {
    if (i.type === "dragstart" && i.element.closest(".palette")) {
      const box = i.element.getBoundingClientRect();
      const element = i.element.cloneNode(true);
      element.style.left = `${box.x + window.pageXOffset}px`;
      element.style.top = `${box.y + window.pageYOffset}px`;
      document.body.appendChild(element);
      yield { ...i, element };
      for await (const j of source) {
        if (j.element === i.element) {
          yield { ...j, element };
          if (j.type === "drop") break;
        } else yield j;
      }
    } else yield i;
  }
}

async function* assignOver(input) {
  function over(element) {
    const box = element.getBoundingClientRect();
    for (const target of document.getElementsByClassName("target")) {
      const targetBox = target.getBoundingClientRect();
      if (
        targetBox.top < box.top &&
        targetBox.left < box.left &&
        targetBox.bottom > box.bottom &&
        targetBox.right > box.right
      )
        return target;
    }
    return null;
  }
  for await (const i of input)
    yield i.element ? { ...i, over: over(i.element) } : i;
}

async function* trash(input) {
  for await (const i of input) {
    if (i.type === "drop" && i.over && i.over.closest(".trash"))
      yield { ...i, type: "remove" };
    else yield i;
  }
}

async function* validateDrop(input) {
  for await (const i of input) {
    if (i.type === "drop") {
      if (!i.over) {
        yield { ...i, type: "dragcancel" };
        continue;
      }
    }
    yield i;
  }
}

async function* flyBack(input) {
  let start;
  for await (const i of input) {
    switch (i.type) {
      case "dragstart":
        start = i;
        break;
      case "dragcancel":
        if (!start) break;
        for await (const j of anim()) // 执行返回动画
          yield {
            ...i,
            type: "dragging",
            x: i.x + j * (start.x - i.x),
            y: i.y + j * (start.y - i.y)
          };
        yield { ...i, type: "drop", over: start.over }; // 如果是从购物车区域移动的, 返回购物车区域
    }
    yield i;
  }
}

async function* animRemove(input) {
  for await (const i of input) {
    if (i.type === "remove") {
      const el = i.element;
      const box = el.getBoundingClientRect();
      for await (const j of anim()) {
        el.style.width = `${box.width * (1 - j)}px`;
        el.style.height = `${box.height * (1 - j)}px`;
        el.style.top = `${box.y + window.pageYOffset + (box.height * j) / 2}px`;
        el.style.left = `${box.x + window.pageXOffset + (box.width * j) / 2}px`;
      }
    }
    yield i;
  }
}

async function* undoCancel(input) {
  let startOver;
  for await (const i of input) {
    if (i.type === "dragstart") {
      startOver = i.over;
    } else if (i.type === "dragcancel") {
      if (startOver) {
        yield { ...i, type: "drop" };
        continue;
      }
    }
    yield i;
  }
}

async function* removeCancelled(input) {
  for await (const i of input) {
    if (i.type === "dragcancel") yield { ...i, type: "remove" };
    else yield i;
  }
}

async function* applyRemove(input) {
  for await (const i of input) {
    if (i.type === "remove") {
      if (i.element.parentNode) i.element.parentNode.removeChild(i.element);
      yield { ...i, type: "drop" };
    } else yield i;
  }
}

async function* setPosition(input) {
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

async function* anim(delay = 100) {
  const start = performance.now();
  const stop = start + delay;
  const step = 1 / delay;
  for (
    let cur;
    (cur = await new Promise(window.requestAnimationFrame)) <= stop;

  )
    yield step * (cur - start);
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
