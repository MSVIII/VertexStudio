// Vertex Studio: Alpine study
// Modules 1–4: GLUT window, primitive colors/sizes, and GLfloat vertex arrays.
// Build in your course OpenGL workspace, with this .cpp active in VS Code.
// MSYS2 UCRT64: g++ object.cpp -o object.exe -lfreeglut -lopengl32
// Run object.exe after a successful build. Keep the MSYS2 UCRT64 bin on PATH.
// Copy the arrays and drawObject() into another GLUT/OpenGL program to reuse.
// Coordinates stay between -1 and 1. Drawing order is back to front.
// Convex polygons retain GL_POLYGON; concave outlines use GL_TRIANGLES.
// Circle is a sampled GL_TRIANGLE_FAN. No separate circle library is needed.
#include <GL/glut.h>

// Evening sun
GLfloat object1Vertices[] = {
    0.49f, 0.52f, 0.0f,
    0.7f, 0.52f, 0.0f,
    0.697414552f, 0.552851238f, 0.0f,
    0.689721868f, 0.584893569f, 0.0f,
    0.67711137f, 0.615338005f, 0.0f,
    0.659893569f, 0.643434903f, 0.0f,
    0.638492424f, 0.668492424f, 0.0f,
    0.613434903f, 0.689893569f, 0.0f,
    0.585338005f, 0.70711137f, 0.0f,
    0.554893569f, 0.719721868f, 0.0f,
    0.522851238f, 0.727414552f, 0.0f,
    0.49f, 0.73f, 0.0f,
    0.457148762f, 0.727414552f, 0.0f,
    0.425106431f, 0.719721868f, 0.0f,
    0.394661995f, 0.70711137f, 0.0f,
    0.366565097f, 0.689893569f, 0.0f,
    0.341507576f, 0.668492424f, 0.0f,
    0.320106431f, 0.643434903f, 0.0f,
    0.30288863f, 0.615338005f, 0.0f,
    0.290278132f, 0.584893569f, 0.0f,
    0.282585448f, 0.552851238f, 0.0f,
    0.28f, 0.52f, 0.0f,
    0.282585448f, 0.487148762f, 0.0f,
    0.290278132f, 0.455106431f, 0.0f,
    0.30288863f, 0.424661995f, 0.0f,
    0.320106431f, 0.396565097f, 0.0f,
    0.341507576f, 0.371507576f, 0.0f,
    0.366565097f, 0.350106431f, 0.0f,
    0.394661995f, 0.33288863f, 0.0f,
    0.425106431f, 0.320278132f, 0.0f,
    0.457148762f, 0.312585448f, 0.0f,
    0.49f, 0.31f, 0.0f,
    0.522851238f, 0.312585448f, 0.0f,
    0.554893569f, 0.320278132f, 0.0f,
    0.585338005f, 0.33288863f, 0.0f,
    0.613434903f, 0.350106431f, 0.0f,
    0.638492424f, 0.371507576f, 0.0f,
    0.659893569f, 0.396565097f, 0.0f,
    0.67711137f, 0.424661995f, 0.0f,
    0.689721868f, 0.455106431f, 0.0f,
    0.697414552f, 0.487148762f, 0.0f,
    0.7f, 0.52f, 0.0f,
};

// Distant ridge
GLfloat object2Vertices[] = {
    -0.86f, -0.32f, 0.0f,
    -0.18f, 0.64f, 0.0f,
    0.5f, -0.32f, 0.0f,
};

// Distant shadow
GLfloat object3Vertices[] = {
    -0.18f, 0.64f, 0.0f,
    0.5f, -0.32f, 0.0f,
    0.03f, -0.32f, 0.0f,
};

// Alpine peak
GLfloat object4Vertices[] = {
    -0.53f, -0.52f, 0.0f,
    0.16f, 0.49f, 0.0f,
    0.9f, -0.52f, 0.0f,
};

// Light & shade
GLfloat object5Vertices[] = {
    0.16f, 0.49f, 0.0f,
    0.9f, -0.52f, 0.0f,
    0.33f, -0.52f, 0.0f,
};

// Snow cap
GLfloat object6Vertices[] = {
    0.06f, 0.26f, 0.0f,
    0.134f, 0.19f, 0.0f,
    0.23f, 0.27f, 0.0f,
    0.23f, 0.27f, 0.0f,
    0.37f, 0.204f, 0.0f,
    0.16f, 0.49f, 0.0f,
    0.06f, 0.26f, 0.0f,
    0.23f, 0.27f, 0.0f,
    0.16f, 0.49f, 0.0f,
    0.06f, 0.26f, 0.0f,
    0.16f, 0.49f, 0.0f,
    -0.036f, 0.204f, 0.0f,
};

void drawObject() {
    glEnableClientState(GL_VERTEX_ARRAY);
    // Evening sun
    glColor4f(0.91372549f, 0.741176471f, 0.568627451f, 1.0f);
    glVertexPointer(3, GL_FLOAT, 0, object1Vertices);
    glDrawArrays(GL_TRIANGLE_FAN, 0, 42);

    // Distant ridge
    glColor4f(0.447058824f, 0.545098039f, 0.647058824f, 1.0f);
    glVertexPointer(3, GL_FLOAT, 0, object2Vertices);
    glDrawArrays(GL_POLYGON, 0, 3);

    // Distant shadow
    glColor4f(0.31372549f, 0.407843137f, 0.505882353f, 1.0f);
    glVertexPointer(3, GL_FLOAT, 0, object3Vertices);
    glDrawArrays(GL_TRIANGLES, 0, 3);

    // Alpine peak
    glColor4f(0.576470588f, 0.866666667f, 0.760784314f, 1.0f);
    glVertexPointer(3, GL_FLOAT, 0, object4Vertices);
    glDrawArrays(GL_POLYGON, 0, 3);

    // Light & shade
    glColor4f(0.298039216f, 0.615686275f, 0.537254902f, 1.0f);
    glVertexPointer(3, GL_FLOAT, 0, object5Vertices);
    glDrawArrays(GL_TRIANGLES, 0, 3);

    // Snow cap
    glColor4f(0.890196078f, 0.941176471f, 0.874509804f, 1.0f);
    glVertexPointer(3, GL_FLOAT, 0, object6Vertices);
    glDrawArrays(GL_TRIANGLES, 0, 12);
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
    glutCreateWindow("Alpine study");
    glClearColor(0.07451f, 0.09804f, 0.11373f, 1.0f);
    // RGBA transparency; painter's order provides the layer stack.
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutMainLoop();
    return 0;
}
