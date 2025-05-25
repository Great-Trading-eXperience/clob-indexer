import v8 from 'v8';

const heapLimit = v8.getHeapStatistics().heap_size_limit;
const result =
    Math.ceil(heapLimit / 1024 / 1024 / 5 / 64) *
    64 *
    1024 *
    1024;

console.log('heap_size_limit:', heapLimit);
console.log('Calculated value:', result);
console.log('Calculated value (MB):', result / 1024 / 1024, 'MB');