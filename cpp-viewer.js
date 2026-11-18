/* Course-style OpenGL export: GLUT (Modules 1–3) and vertex arrays (Module 4). */
(function(root){
  'use strict';
  const modes=['GL_POINTS','GL_LINES','GL_LINE_LOOP','GL_LINE_STRIP','GL_TRIANGLES','GL_TRIANGLE_STRIP','GL_TRIANGLE_FAN','GL_QUADS','GL_QUAD_STRIP','GL_POLYGON'];
  const clean=s=>String(s||'Object').replace(/[^\x20-\x7e]|\\/g,' ').trim();
  function number(n){const s=String(Number((Object.is(n,-0)?0:n).toPrecision(9)));return s+(/[.eE]/.test(s)?'f':'.0f');}
  function create(draws,name){
    const arrays=draws.map((d,i)=>`// ${clean(d.name)}\nGLfloat object${i+1}Vertices[] = {\n${d.vertices.map(p=>'    '+[p.x,p.y,0].map(number).join(', ')+',').join('\n')}\n};`).join('\n\n');
    const calls=draws.map((d,i)=>{
      const size=d.mode===0?`    glPointSize(${number(d.pointSize)});\n`:d.mode>=1&&d.mode<=3?`    glLineWidth(${number(d.lineWidth)});\n`:'';
      return `    // ${clean(d.name)}\n    glColor4f(${d.rgba.map(number).join(', ')});\n${size}    glVertexPointer(3, GL_FLOAT, 0, object${i+1}Vertices);\n    glDrawArrays(${modes[d.mode]}, 0, ${d.vertices.length});`;
    }).join('\n\n');
    return `// Vertex Studio: ${clean(name)}
// Modules 1–4: GLUT window, primitive colors/sizes, and GLfloat vertex arrays.
// Build in your course OpenGL workspace, with this .cpp active in VS Code.
// MSYS2 UCRT64: g++ object.cpp -o object.exe -lfreeglut -lopengl32
// Run object.exe after a successful build. Keep the MSYS2 UCRT64 bin on PATH.
// Copy the arrays and drawObject() into another GLUT/OpenGL program to reuse.
// Coordinates stay between -1 and 1. Drawing order is back to front.
// Convex polygons retain GL_POLYGON; concave outlines use GL_TRIANGLES.
// Circle is a sampled GL_TRIANGLE_FAN. No separate circle library is needed.
#include <GL/glut.h>

${arrays || '// Empty scene: add primitives in Vertex Studio and export again.'}

void drawObject() {
    glEnableClientState(GL_VERTEX_ARRAY);
${calls}
    glDisableClientState(GL_VERTEX_ARRAY);
}

void display() {
    glClear(GL_COLOR_BUFFER_BIT);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
    drawObject();
    glFlush();
}

// Module 7 viewport/projection: keep circles round when the window is resized.
void reshape(int width, int height) {
    int side = width < height ? width : height;
    glViewport((width - side) / 2, (height - side) / 2, side, side);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
}

int main(int argc, char** argv) {
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGBA);
    glutInitWindowSize(700, 700);
    glutCreateWindow(${JSON.stringify(clean(name))});
    glClearColor(0.07451f, 0.09804f, 0.11373f, 1.0f);
    // RGBA transparency; painter's order provides the layer stack.
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutMainLoop();
    return 0;
}
`;
  }
  const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CppViewer=api;
})(typeof globalThis!=='undefined'?globalThis:this);
