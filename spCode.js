export const spCode = `
setMaxReflections(2)

function gyroid(scale) {
  let s = getSpace();
  s = s* scale;
  return dot(sin(s), cos(vec3(s.z, s.x, s.y) +PI))/ scale ;
}
//setMaxIterations(100)
setStepSize(0.9);
//let n = noise(getSpace()*3);
//backgroundColor(n, n, n);

shine(.4)
metal(.6);

let gyScale = 6.8; // Default constant value
let gy = gyroid(gyScale);
let n = vectorContourNoise(getSpace() + vec3(0, 0, time*.1), .04+gy*.1, 1.2);
n = pow(sin(n*2)*.5 +.5, vec3(4))
color(n)
shape(() => {
  rotateX(time*.1)
  mirrorN(6.2, .02);
  sphere(.02);
})()
//box(2, 1, .1)
difference();
setSDF(gy);

`;
