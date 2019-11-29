// vanila JS example
async function* counter(input) {
  //info 这是一个 reducer, 但 state 需要自行同步
  let state = 0;
  console.log("counter begin", input);
  yield { type: "VALUE", value: state }; // 初始状态
  for await (const action of input) {
    console.log("counter loop", action);
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
    // yield action;
  }
}

/**
 *
 * @param main 即input, 传入pipe生成的处理器中
 */
function createStore(main) {
  //info 创建一个 store
  let state;
  let callback;
  const queue = [];
  const producer = (async function* producer() {
    for (;;) {
      while (queue.length) yield queue.shift();
      await new Promise(i => {
        callback = i;
        console.log("promised");
      });
      callback = null;
    }
  })();
  //info: consumer 的职责是同步reducer 处理后的 state 值
  (async function consumer() {
    for await (const i of main(producer)) {
      console.log("consume loop", i);
      if (i.type === "VALUE") state = i.value;
    }
  })();
  return {
    getState() {
      return state;
    },
    dispatch(action) {
      if (callback) {
        callback();
        console.log("callback called");
      }
      queue.push(action);
    }
  };
}

async function* render(input) {
  console.log("render begin");
  for await (const i of input) {
    console.log("render loop", i);
    if (i.type === "VALUE") valueEl.innerHTML = i.value.toString();
    yield i;
  }
}

function pipe(...args) {
  return function(i) {
    for (const f of args) i = f(i);
    return i;
  };
}

var store = createStore(pipe(counter, render));

var valueEl = document.getElementById("value");

document.getElementById("increment").addEventListener("click", function() {
  store.dispatch({ type: "INCREMENT" });
});
document.getElementById("decrement").addEventListener("click", function() {
  store.dispatch({ type: "DECREMENT" });
});
document.getElementById("incrementIfOdd").addEventListener("click", function() {
  if (store.getState() % 2 !== 0) {
    store.dispatch({ type: "INCREMENT" });
  }
});
document.getElementById("incrementAsync").addEventListener("click", function() {
  setTimeout(function() {
    store.dispatch({ type: "INCREMENT" });
  }, 1000);
});
