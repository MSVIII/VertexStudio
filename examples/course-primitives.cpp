// Vertex Studio: Course primitive study
// Modules 1–4: GLUT window, primitive colors/sizes, and GLfloat vertex arrays.
// Build in your course OpenGL workspace, with this .cpp active in VS Code.
// MSYS2 UCRT64: g++ object.cpp -o object.exe -lfreeglut -lopengl32
// Run object.exe after a successful build. Keep the MSYS2 UCRT64 bin on PATH.
// Copy the arrays and drawObject() into another GLUT/OpenGL program to reuse.
// Coordinates stay between -1 and 1. Drawing order is back to front.
// Convex polygons retain GL_POLYGON; concave outlines use GL_TRIANGLES.
// Circle is a sampled GL_TRIANGLE_FAN. No separate circle library is needed.
#include <GL/glut.h>

// Quad tile
GLfloat object1Vertices[] = {
    -0.8f, -0.6f, 0.0f,
    -0.2f, -0.6f, 0.0f,
    -0.1f, -0.1f, 0.0f,
    -0.7f, 0.0f, 0.0f,
};

// Quad ribbon
GLfloat object2Vertices[] = {
    0.1f, -0.6f, 0.0f,
    0.6f, -0.6f, 0.0f,
    0.16f, -0.2f, 0.0f,
    0.64f, -0.2f, 0.0f,
    0.04f, 0.2f, 0.0f,
    0.7f, 0.2f, 0.0f,
};

// Circle fan
GLfloat object3Vertices[] = {
    -0.45f, 0.55f, 0.0f,
    -0.2f, 0.55f, 0.0f,
    -0.201203818f, 0.574504285f, 0.0f,
    -0.20480368f, 0.598772581f, 0.0f,
    -0.210764916f, 0.622571169f, 0.0f,
    -0.219030117f, 0.645670858f, 0.0f,
    -0.229519684f, 0.667849184f, 0.0f,
    -0.242132597f, 0.688892558f, 0.0f,
    -0.256747387f, 0.708598321f, 0.0f,
    -0.273223305f, 0.726776695f, 0.0f,
    -0.291401679f, 0.743252613f, 0.0f,
    -0.311107442f, 0.757867403f, 0.0f,
    -0.332150816f, 0.770480316f, 0.0f,
    -0.354329142f, 0.780969883f, 0.0f,
    -0.377428831f, 0.789235084f, 0.0f,
    -0.401227419f, 0.79519632f, 0.0f,
    -0.425495715f, 0.798796182f, 0.0f,
    -0.45f, 0.8f, 0.0f,
    -0.474504285f, 0.798796182f, 0.0f,
    -0.498772581f, 0.79519632f, 0.0f,
    -0.522571169f, 0.789235084f, 0.0f,
    -0.545670858f, 0.780969883f, 0.0f,
    -0.567849184f, 0.770480316f, 0.0f,
    -0.588892558f, 0.757867403f, 0.0f,
    -0.608598321f, 0.743252613f, 0.0f,
    -0.626776695f, 0.726776695f, 0.0f,
    -0.643252613f, 0.708598321f, 0.0f,
    -0.657867403f, 0.688892558f, 0.0f,
    -0.670480316f, 0.667849184f, 0.0f,
    -0.680969883f, 0.645670858f, 0.0f,
    -0.689235084f, 0.622571169f, 0.0f,
    -0.69519632f, 0.598772581f, 0.0f,
    -0.698796182f, 0.574504285f, 0.0f,
    -0.7f, 0.55f, 0.0f,
    -0.698796182f, 0.525495715f, 0.0f,
    -0.69519632f, 0.501227419f, 0.0f,
    -0.689235084f, 0.477428831f, 0.0f,
    -0.680969883f, 0.454329142f, 0.0f,
    -0.670480316f, 0.432150816f, 0.0f,
    -0.657867403f, 0.411107442f, 0.0f,
    -0.643252613f, 0.391401679f, 0.0f,
    -0.626776695f, 0.373223305f, 0.0f,
    -0.608598321f, 0.356747387f, 0.0f,
    -0.588892558f, 0.342132597f, 0.0f,
    -0.567849184f, 0.329519684f, 0.0f,
    -0.545670858f, 0.319030117f, 0.0f,
    -0.522571169f, 0.310764916f, 0.0f,
    -0.498772581f, 0.30480368f, 0.0f,
    -0.474504285f, 0.301203818f, 0.0f,
    -0.45f, 0.3f, 0.0f,
    -0.425495715f, 0.301203818f, 0.0f,
    -0.401227419f, 0.30480368f, 0.0f,
    -0.377428831f, 0.310764916f, 0.0f,
    -0.354329142f, 0.319030117f, 0.0f,
    -0.332150816f, 0.329519684f, 0.0f,
    -0.311107442f, 0.342132597f, 0.0f,
    -0.291401679f, 0.356747387f, 0.0f,
    -0.273223305f, 0.373223305f, 0.0f,
    -0.256747387f, 0.391401679f, 0.0f,
    -0.242132597f, 0.411107442f, 0.0f,
    -0.229519684f, 0.432150816f, 0.0f,
    -0.219030117f, 0.454329142f, 0.0f,
    -0.210764916f, 0.477428831f, 0.0f,
    -0.20480368f, 0.501227419f, 0.0f,
    -0.201203818f, 0.525495715f, 0.0f,
    -0.2f, 0.55f, 0.0f,
};

void drawObject() {
    glEnableClientState(GL_VERTEX_ARRAY);
    // Quad tile
    glColor4f(0.560784314f, 0.658823529f, 0.929411765f, 1.0f);
    glVertexPointer(3, GL_FLOAT, 0, object1Vertices);
    glDrawArrays(GL_QUADS, 0, 4);

    // Quad ribbon
    glColor4f(0.576470588f, 0.866666667f, 0.760784314f, 1.0f);
    glVertexPointer(3, GL_FLOAT, 0, object2Vertices);
    glDrawArrays(GL_QUAD_STRIP, 0, 6);

    // Circle fan
    glColor4f(0.929411765f, 0.705882353f, 0.603921569f, 1.0f);
    glVertexPointer(3, GL_FLOAT, 0, object3Vertices);
    glDrawArrays(GL_TRIANGLE_FAN, 0, 66);
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
    glutCreateWindow("Course primitive study");
    glClearColor(0.07451f, 0.09804f, 0.11373f, 1.0f);
    // RGBA transparency; painter's order provides the layer stack.
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutMainLoop();
    return 0;
}
