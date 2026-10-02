import zlib, struct, sys
def read_png(path):
    data = open(path,'rb').read()
    pos = 8; w=h=None; idat=b''; ctype=None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]; typ = data[pos+4:pos+8]; chunk = data[pos+8:pos+8+ln]
        if typ==b'IHDR': w,h,bd,ctype = struct.unpack('>IIBB', chunk[:10])
        elif typ==b'IDAT': idat += chunk
        pos += 12+ln
    raw = zlib.decompress(idat); ch = {0:1,2:3,3:1,4:2,6:4}[ctype]; stride=w*ch
    out=bytearray(); prev=bytearray(stride); p=0
    for y in range(h):
        f=raw[p]; p+=1; line=bytearray(raw[p:p+stride]); p+=stride
        if f==1:
            for i in range(ch,stride): line[i]=(line[i]+line[i-ch])&255
        elif f==2:
            for i in range(stride): line[i]=(line[i]+prev[i])&255
        elif f==3:
            for i in range(stride):
                a=line[i-ch] if i>=ch else 0
                line[i]=(line[i]+((a+prev[i])>>1))&255
        elif f==4:
            for i in range(stride):
                a=line[i-ch] if i>=ch else 0; b=prev[i]; c=prev[i-ch] if i>=ch else 0
                pp=a+b-c; pa=abs(pp-a); pb=abs(pp-b); pc=abs(pp-c)
                pr=a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                line[i]=(line[i]+pr)&255
        out+=line; prev=line
    return w,h,ch,bytes(out)
def stats(name):
    w,h,ch,px = read_png(name)
    def avg(x0,x1,y0,y1):
        r=g=b=n=0
        for y in range(y0,y1,3):
            for x in range(x0,x1,3):
                i=(y*w+x)*ch; r+=px[i]; g+=px[i+1]; b+=px[i+2]; n+=1
        return (r//n,g//n,b//n)
    total = avg(0,w,0,h)
    lum = sum(total)/3
    sky = avg(w//3, 2*w//3, 0, h//10)
    ground = avg(w//3, 2*w//3, int(h*0.75), h)
    print(f"{name}: яркость={lum:.0f} небо={sky} низ={ground} соотнош_син={sky[2]-sky[0]:+d}")
    return lum, sky
for n in sys.argv[1:]:
    stats(n)
