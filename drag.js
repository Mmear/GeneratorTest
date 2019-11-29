async function* main(input) {
  const source = share(input);
  // const source = input;
  for await (const i of source) {
    if (i.type === "pointerdown") {
      const element = i.target.closest(".draggable"); //info: 获取最近点击元素
      if (element) {
        const box = element.getBoundingClientRect();
        const x = box.x + window.pageXOffset - i.x; //info: 计算移动的距离
        const y = box.y + +window.pageYOffset - i.y;
        for await (const j of source) {
          if (j.type === "pointerup") break; /// 不使用 share 函数进行包装的话, pointerup 的 bread 事件会调用source 的 return 函数, 终止整个迭代
          if (j.type === "pointermove") {
            element.style.left = `${j.x + x}px`;
            element.style.top = `${j.y + y}px`;
          }
          yield j;
        }
      }
    }
    yield i;
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
    await new Promise(i => (callback = i)); //info: 等待上一个 action 派发完再生产下一个 action
  }
}
console.log(produce[Symbol.asyncIterator]);
async function consume(input) {
  for await (const i of input) {
  }
}

document.addEventListener("pointermove", send, false);
document.addEventListener("pointerdown", send, false);
document.addEventListener("pointerup", send, false);

function share(iterable) {
  const iterator = iterable[Symbol.asyncIterator](); // 对于AsyncGenerator, 就是 iterable 本身
  return {
    next(value) {
      return iterator.next(value);
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}

consume(main(produce()));
