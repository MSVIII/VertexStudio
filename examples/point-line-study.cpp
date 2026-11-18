// Vertex Studio: Point & line study
// Modules 1–4: GLUT window, primitive colors/sizes, and GLfloat vertex arrays.
// Build in your course OpenGL workspace, with this .cpp active in VS Code.
// MSYS2 UCRT64: g++ object.cpp -o object.exe -lfreeglut -lopengl32
// Run object.exe after a successful build. Keep the MSYS2 UCRT64 bin on PATH.
// Copy the arrays and drawObject() into another GLUT/OpenGL program to reuse.
// Coordinates stay between -1 and 1. Drawing order is back to front.
// Convex polygons retain GL_POLYGON; concave outlines use GL_TRIANGLES.
// Circle is a sampled GL_TRIANGLE_FAN. No separate circle library is needed.
#include <GL/glut.h>

// Canvas tile
GLfloat object1Vertices[] = {
    -0.8f, -0.6f, 0.0f,
    0.8f, -0.6f, 0.0f,
    0.8f, 0.6f, 0.0f,
    -0.8f, 0.6f, 0.0f,
};

// Wide line
GLfloat object2Vertices[] = {
    -0.6f, -0.4f, 0.0f,
    0.6f, -0.4f, 0.0f,
};

// Mountain path
GLfloat object3Vertices[] = {
    -0.6f, -0.2f, 0.0f,
    0.0f, 0.4f, 0.0f,
    0.6f, -0.2f, 0.0f,
};

// Frame
GLfloat object4Vertices[] = {
    -0.8f, -0.6f, 0.0f,
    0.8f, -0.6f, 0.0f,
    0.8f, 0.6f, 0.0f,
    -0.8f, 0.6f, 0.0f,
};

// Plot points
GLfloat object5Vertices[] = {
    -0.6f, -0.2f, 0.0f,
    0.0f, 0.4f, 0.0f,
    0.6f, -0.2f, 0.0f,
};

void drawObject() {
    glEnableClientState(GL_VERTEX_ARRAY);
    // Canvas tile
    glColor4f(0.149019608f, 0.247058824f, 0.270588235f, 1.0f);
    glVertexPointer(3, GL_FLOAT, 0, object1Vertices);
    glDrawArrays(GL_POLYGON, 0, 4);

    // Wide line
    glColor4f(0.929411765f, 0.705882353f, 0.603921569f, 1.0f);
    glLineWidth(24.0f);
    glVertexPointer(3, GL_FLOAT, 0, object2Vertices);
    glDrawArrays(GL_LINES, 0, 2);

    // Mountain path
    glColor4f(0.576470588f, 0.866666667f, 0.760784314f, 1.0f);
    glLineWidth(16.0f);
    glVertexPointer(3, GL_FLOAT, 0, object3Vertices);
    glDrawArrays(GL_LINE_STRIP, 0, 3);

    // Frame
    glColor4f(0.560784314f, 0.658823529f, 0.929411765f, 1.0f);
    glLineWidth(5.0f);
    glVertexPointer(3, GL_FLOAT, 0, object4Vertices);
    glDrawArrays(GL_LINE_LOOP, 0, 4);

    // Plot points
    glColor4f(0.776470588f, 0.647058824f, 0.874509804f, 1.0f);
    glPointSize(30.0f);
    glVertexPointer(3, GL_FLOAT, 0, object5Vertices);
    glDrawArrays(GL_POINTS, 0, 3);
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
    glutCreateWindow("Point & line study");
    glClearColor(0.07451f, 0.09804f, 0.11373f, 1.0f);
    // RGBA transparency; painter's order provides the layer stack.
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutMainLoop();
    return 0;
}
