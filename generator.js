
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

async function* test3() {
  for await (const i of test2()) {
    console.log('hello', i);
    yield 'test3';
  }
}

async function test4() {
  for await (const i of test3()) {
    console.log(i);
  }
}
test4();

const dd = 'dd';
switch(dd) {
  case 'dd': 
    console.log('1');
    return;
  case 'ddd':
    console.log('2');
}