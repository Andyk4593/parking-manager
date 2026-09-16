// Original pixel icon; no image generation service or build-time graphics library.
import fs from 'node:fs';
import zlib from 'node:zlib';
const W=256,data=Buffer.alloc((W*4+1)*W);
function box(x,y,w,h,color){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const offset=yy*(W*4+1)+1+xx*4;data.set([...color,255],offset);}}
box(0,0,256,256,[11,37,23]);box(16,16,224,224,[0,111,61]);box(24,24,208,8,[82,160,94]);box(24,224,208,8,[0,67,38]);
for(const [row,line]of ['11110','11011','11011','11110','11000','11000','11000'].entries())for(let x=0;x<5;x++)if(line[x]==='1')box(72+x*24,44+row*24,24,24,[241,239,205]);
function crc(b){let c=0xffffffff;for(const n of b){c^=n;for(let i=0;i<8;i++)c=(c>>>1)^(c&1?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,b){const name=Buffer.from(type),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(b.length);sum.writeUInt32BE(crc(Buffer.concat([name,b])));return Buffer.concat([len,name,b,sum]);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W);ihdr.writeUInt32BE(W,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(data)),chunk('IEND',Buffer.alloc(0))]);
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
fs.writeFileSync('public/assets/icon.png',png);fs.writeFileSync('public/assets/icon.ico',Buffer.concat([header,png]));
