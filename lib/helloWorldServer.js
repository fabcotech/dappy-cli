const https = require('https');

const { log } = require('./utils');

module.exports.helloWorldServer = async () => {
  log("Running helloworld TLS server");

  const key = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCm5gX+aVaVrPbW
59Dw9NE2ITjztB1LINuM1T8DoTU8RbOpzhOcRYPtWT+P91s17tSWpryNeezJPBVd
J80G3jhSWLN4N833bbj5kgAe72RHw6fooZczHujG0JgLbhDJ14lgvA0/QFnC7nY1
ufjliRjtWDFJ9eq6rC73dWmgntoByMxybxejdt33sn2JB+41GBVhdiOKjbAcC9o7
Z0cz/AhX8RhjknxBGQIDnLFz0ZQ4Oy1WvmsONn7CLrOHystoKnd/hRetSZ9rnAMP
IzZI9If7lkd4PXGKVNkJaASZlKNzJfcwAZ+Cw3TpFmfi3xidcmp7BDnNtFox3V+Y
wcxVXeG5AgMBAAECggEAGmu+ACqfLTOuoefHK8Coi/1SEuvCWr3ZXnVLCUvlww8K
ZEkTfADZ4+Ll4pMXH+BuoWjE3vqxvEukMCqYVPbXNgYFEfTM84IDBJM911KGGVbv
x65+YqEz2swefb9krfyj1VSqc4cVjqaJv8ibOS8XwJ8JB9CD4nMBPmXFHSB4mkvK
HEXiB8HNyBr2ed7Q0+2aeiz2kJkkTvuiBKT06y3BeDU27jNkGLAwr3No9Lx9EP1b
yme881daeQZ9F9r2/g6aldmk48gRXjvU2/1JaAPLrvHxqkTn8VGsWp9wdAEYO/rv
cfwNbcJQuCEoOIL8aC3mo51F16HKQR6NAdMBlNAi7wKBgQDTv+iPptRe0FsUiANU
xmY2uRAMplxqFRBFcr8MsOdHQ2Rej8IDEbNj4w6hdKjgSRtRlxkLTvoksbjgGqLG
yDQWRMDBPVhepiTG6qt6OtMlvvIC8Qgn3qa1s0iLvYBDw0+wvrpTM62L2mqaRVNj
4N2f9HWpCjP0P9n7tDCSiXqTRwKBgQDJxrB4rCk4xSx8X7ni8RRnY1F2nN9K96pB
k6B6oYvguABQHgVYQzMqEpYjPVupbEt6H5HY5DydkOYxfu3e7+2L9bELRUJ3p1Yv
OKLQ1iZkWl4u/3wy4sbf6aLBC0DJhDlE9bjeCmNh6tNKiHSsfsVOjKEPf1ASHB86
k9WLkvxi/wKBgQCgrwyHlg2qNWooVl5Qwo1mEWFAeC3AwmMqkDyyILwgs99CcszD
D3eV4QOFOcW9DT0R2RtEHZZsqgCk7xF+zwXXsCyldyvMBz/5QrMFegYoqpFz8fxC
ZQ8U6wuuHwtqYJfkg5dY8+pKKmCi2ODC9iy36QYwVHHAc4OzIbWKPZEqmQKBgGhq
/QoFtfNd/k6Cz1SFA9UZDaA/QEKwdhgniIXNsfBh6C+NyaBKbmDYa3/jEdtUYp7Z
VYWTX1b/FFEK6ZhUO28Rf0Rg3CvFmhEn0wIVwJpwNYtGxYQj3V0ksAgMhcODPIvW
SYwGfjW+6wcIJLDbjcm/dt3pOYuVqAeNV5Y6Q4gLAoGBAKIO2AlsbiK6b8eQWTQL
XGhfi3nxTijvoCQCJC5Uh0cMfpDM8mU+rL+FW3RPBYLtjnB8fRrB+03IklSimfj3
POlkjBie6vChhYXmtmnhZSP/X0mDqo6ejy0NBJzrevshswOzjYmHgKRfghmt1jcz
hfsBuoANZluoIvEECjKL0wO5
-----END PRIVATE KEY-----`;

  const cert = `-----BEGIN CERTIFICATE-----
MIIDBzCCAe+gAwIBAgIUCdHjpZRF4xPWeoiOUY0/LkEBLs8wDQYJKoZIhvcNAQEL
BQAwGjEYMBYGA1UEAwwPPERBUFBZX05FVFdPUks+MB4XDTIyMDcyOTA5MzQwMVoX
DTMwMTAxNTA5MzQwMVowGjEYMBYGA1UEAwwPPERBUFBZX05FVFdPUks+MIIBIjAN
BgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApuYF/mlWlaz21ufQ8PTRNiE487Qd
SyDbjNU/A6E1PEWzqc4TnEWD7Vk/j/dbNe7Ulqa8jXnsyTwVXSfNBt44UlizeDfN
9224+ZIAHu9kR8On6KGXMx7oxtCYC24QydeJYLwNP0BZwu52Nbn45YkY7VgxSfXq
uqwu93VpoJ7aAcjMcm8Xo3bd97J9iQfuNRgVYXYjio2wHAvaO2dHM/wIV/EYY5J8
QRkCA5yxc9GUODstVr5rDjZ+wi6zh8rLaCp3f4UXrUmfa5wDDyM2SPSH+5ZHeD1x
ilTZCWgEmZSjcyX3MAGfgsN06RZn4t8YnXJqewQ5zbRaMd1fmMHMVV3huQIDAQAB
o0UwQzAiBgNVHREEGzAZgglsb2NhbGhvc3SCDGhlbGxvd29ybGQuZDAdBgNVHQ4E
FgQUT/33/QPI6OZOC+APZ86mEUiGGLAwDQYJKoZIhvcNAQELBQADggEBAKIIn+Iu
srpmkpN2UeoUdz2TKdp6x3gDAlkOuPLsZQz+y1drXNAbY+b7trRM4ezPu1h322ns
fTyHUjUw14MitOgk79Rh22vPWJEbaWHLPDveYuSW7NvyN9AOS0UnfWBJE3p0445d
8O34ul8kokHUjXljrBGv+PVEWbUQsyOp+uLZUVFq7LxdHHkdh14feEAN6xdnCgUs
SVcLOdZdtO27VncLVuDHnE8xR2gQtk31AzuxAf6uRMpWsH6Gpze2mutCkeOsDtmL
kFPxv+yBB8aJ9byBGE5c7xiv6h8X2BMypk0QFGU7SHLvLULWXgfTMHm/lcAMqlBl
zauevJenIVf7IG8=
-----END CERTIFICATE-----`;

  const options = {
    key,
    cert,
    minVersion: 'TLSv1.3',
    cipher: 'TLS_AES_256_GCM_SHA384',
  };
  https.createServer(
    options,
    (req, res) => {
      console.log(req.url);
      res.writeHead(200);
      res.end("<html><body style='background:#fff;display:flex;justify-content:center;align-items:center;font-size:3rem;'>Hello world !</body></html>")
    }
  ).listen(3008);

  console.log("(helloworld) listenning on 127.0.0.1:3008")
};
