const http = require('http');

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const payload = '--' + boundary + '\r\n' +
                'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n' +
                'Content-Type: text/plain\r\n\r\n' +
                'Hello world\r\n' +
                '--' + boundary + '--\r\n';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/upload',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': payload.length
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', data));
});

req.on('error', e => console.error(e));
req.write(payload);
req.end();
