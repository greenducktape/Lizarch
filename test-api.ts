import http from 'http';

const get = (path: string) => new Promise((resolve, reject) => {
  http.get(`http://localhost:3000${path}`, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve({ status: res.statusCode, data: data.substring(0, 100) }));
  }).on('error', reject);
});

async function test() {
  console.log(await get('/api/health'));
  console.log(await get('/api/books'));
  console.log(await get('/api/chapters'));
  console.log(await get('/api/cross-references'));
}

test().catch(console.error);
