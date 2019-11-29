function* test() {
  // yield new Promise(res => setTimeout(() => res(), 3000)).then(() => 100);
  yield new Promise(res => setTimeout(() => res(), 3000)).then(() => 200);
  yield new Promise(res => setTimeout(() => res(), 3000)).then(() => 200);
}
async function* test2() {
  for await (const i of test()) {
    console.log('from test1', i);
    yield "test2";
  }
}

test2().next();