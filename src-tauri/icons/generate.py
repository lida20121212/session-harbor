from pathlib import Path
import struct,zlib
root=Path(__file__).resolve().parent
root.joinpath('icon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#152d43"/><path d="M64 56h24v60h80V56h24v144h-24v-60H88v60H64z" fill="#f3f6f8"/><circle cx="128" cy="64" r="12" fill="#245fe5"/></svg>')
def png(size):
 def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
 rows=[]
 for y in range(size):
  row=bytearray([0])
  for x in range(size):
   u=(x+.5)*256/size;v=(y+.5)*256/size
   rgb=(21,45,67)
   if (64<=u<88 or 168<=u<192) and 56<=v<200 or 88<=u<168 and 116<=v<140:rgb=(243,246,248)
   if (u-128)**2+(v-64)**2<=144:rgb=(36,95,229)
   row.extend((*rgb,255))
  rows.append(bytes(row))
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
image=png(256)
root.joinpath('icon.png').write_bytes(image)
root.joinpath('32x32.png').write_bytes(png(32))
root.joinpath('icon.ico').write_bytes(struct.pack('<HHH',0,1,1)+struct.pack('<BBBBHHII',0,0,0,0,1,32,len(image),22)+image)
print('Generated SVG, RGBA PNG (32/256), and PNG-backed ICO (256).')
