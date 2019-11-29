/** 从左向右依次输入 */
run(pipe(counter, incrementAsync, incrementIfOdd, control, render));
/** 整体思路与 redux 类似, 通过 middleware 进行行为控制 */
async function* counter(input) {
  let state = 0;
  yield { type: "VALUE", value: state };
  for await (const action of input) {
    switch (action.type) {
      case "INCREMENT":
        state++;
        yield { type: "VALUE", value: state };
        break;
      case "DECREMENT":
        state--;
        yield { type: "VALUE", value: state };
        break;
    }
    /** 将 action 传递下去, 之后可能会有其他业务函数 */
    yield action;
  }
}

/** 渲染逻辑和业务逻辑分开处理 */
async function* control(input, dispatch) {
  const menu = {};
  for await (const i of input) {
    yield i;
    if (i.type === "MENU_ITEM")
      menu[i.index] = React.cloneElement(i.value, { key: i.index });
    else if (i.type === "VALUE")
      yield {
        type: "CONTROL",
        value: (
          <p>
            Clicked: {i.value} times
            <button onClick={() => dispatch({ type: "INCREMENT" })}>+</button>
            <button onClick={() => dispatch({ type: "DECREMENT" })}>-</button>
            {Object.values(menu)}
          </p>
        )
      };
  }
}

async function* incrementAsync(input, dispatch) {
  yield {
    type: "MENU_ITEM",
    index: 100,
    value: (
      <button
        onClick={() => setTimeout(() => dispatch({ type: "INCREMENT" }), 1000)}
      >
        Increment async
      </button>
    )
  };
  yield* input;
}

async function* incrementIfOdd(input, dispatch) {
  for await (const i of input) {
    if (i.type === "VALUE")
      yield {
        type: "MENU_ITEM",
        index: 200,
        value: (
          <button
            onClick={() => i.value % 2 && dispatch({ type: "INCREMENT" })}
          >
            Increment if Odd
          </button>
        )
      };
    yield i;
  }
}

async function* render(input) {
  const el = document.getElementById("root");
  for await (const i of input) {
    if (i.type === "CONTROL") ReactDOM.render(i.value, el);
    yield i;
  }
}
/** 运行主程序 */
async function run(main) {
  let callback;
  const queue = [];
  const producer = (async function* producer() {
    for (;;) {
      while (queue.length) yield queue.shift();
      await new Promise(resolve => (callback = resolve));
      callback = null;
    }
  })();
  function dispatch(action) {
    if (callback) callback();
    queue.push(action);
  }
  for await (const i of main(producer, dispatch)) {
  }
}
function pipe(...args) {
  return function(input, dispatch) {
    for (const f of args) input = f(input, dispatch);
    return input;
  };
}
function pipe(...fns) {
  return (input, dispatch) =>
    fns.reduce((pre, cur) => cur(pre(input, dispatch)));
}
async function* a(ff) {
  yield new Promise(res =>
    setTimeout(() => {
      res("test");
    }, 3000)
  );
  yield "a";
}

const t = a();
const f = t[Symbol.asyncIterator]("ggg");

t.next().then(console.log);
f.next().then(console.log);
console.log("hi");

const middlewareList = [];
const app = {};
app.use = function use(middleware) {
  this.middleware.push(middleware);
};
middlewareList.reduce((prev, nextFn) => {}, middlewareList[0]);
