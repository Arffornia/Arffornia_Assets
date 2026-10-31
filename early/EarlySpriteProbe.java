/*
 * Early-window feasibility probe: can the pre-Minecraft loading window (FML, raw GL 3.2 core, 854x480,
 * redrawn on a 20 Hz tick) play a GIF-like animation, and what does it cost?
 *
 * It does exactly what a custom ImmediateWindowProvider would do on each tick: draw a baked backdrop,
 * draw frame (tick % frames) of a sprite sheet, draw the progress bar. Every tick is read back and
 * written as a PNG, so the result can be encoded at 20 fps and watched as the player would see it.
 *
 * usage: java -cp <lwjgl jars> EarlySpriteProbe.java <backdrop.png> <sheet.png> <cols> <frames> <cell> <outDir> [ticks] [static|anim]
 *        [slotX slotY slotW slotH overlay.png]   (round 3: the assembly-line band drawn 1:1, then an overlay on top)
 * Run headless: xvfb-run -a java ... (see early-probe.sh). Nothing here ships.
 */
import static org.lwjgl.glfw.GLFW.*;
import static org.lwjgl.opengl.GL32C.*;

import java.nio.ByteBuffer;
import java.nio.FloatBuffer;
import java.nio.IntBuffer;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.GL;
import org.lwjgl.stb.STBImage;
import org.lwjgl.stb.STBImageWrite;

public class EarlySpriteProbe {
    static final int W = 854, H = 480;

    public static void main(String[] a) {
        String backdrop = a[0], sheet = a[1], outDir = a[5];
        int cols = Integer.parseInt(a[2]), frames = Integer.parseInt(a[3]), cell = Integer.parseInt(a[4]);
        int ticks = a.length > 6 ? Integer.parseInt(a[6]) : 80;
        boolean still = a.length > 7 && a[7].equals("static");
        float sx = 299, sy = 56, sw = 256, shh = 256; String overlay = null;
        if (a.length > 12) { sx = Float.parseFloat(a[8]); sy = Float.parseFloat(a[9]); sw = Float.parseFloat(a[10]); shh = Float.parseFloat(a[11]); overlay = a[12]; }
        if (!glfwInit()) throw new IllegalStateException("glfwInit failed");
        glfwDefaultWindowHints();
        glfwWindowHint(GLFW_VISIBLE, GLFW_FALSE);
        glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
        glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GLFW_TRUE);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 2); // the lowest profile FML falls back to
        long win = glfwCreateWindow(W, H, "early sprite probe", 0L, 0L);
        if (win == 0) throw new IllegalStateException("no GL 3.2 core context");
        glfwMakeContextCurrent(win);
        GL.createCapabilities();
        System.out.println("GL_RENDERER=" + glGetString(GL_RENDERER) + " GL_VERSION=" + glGetString(GL_VERSION));

        int fbo = glGenFramebuffers(), target = glGenTextures();
        glBindTexture(GL_TEXTURE_2D, target);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, W, H, 0, GL_RGBA, GL_UNSIGNED_BYTE, (ByteBuffer) null);
        glBindFramebuffer(GL_FRAMEBUFFER, fbo);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, target, 0);

        long u0 = System.nanoTime();
        int[] bd = new int[2], sh = new int[2];
        int texBackdrop = load(backdrop, bd), texSheet = load(sheet, sh);
        int[] ov = new int[2]; int texOverlay = overlay != null ? load(overlay, ov) : 0;
        double uploadMs = (System.nanoTime() - u0) / 1e6;
        double vramMb = (bd[0] * bd[1] + sh[0] * sh[1]) * 4 / 1048576.0;
        System.out.printf("textures: backdrop %dx%d, sheet %dx%d, %.1f MB RGBA, load+upload %.1f ms%n", bd[0], bd[1], sh[0], sh[1], vramMb, uploadMs);

        int prog = program(
                "#version 150\nin vec2 pos; in vec2 uv; in vec4 col; out vec2 v; out vec4 c; uniform vec2 size;\n"
                        + "void main(){ v = uv; c = col; gl_Position = vec4(pos / size * 2.0 - 1.0, 0.0, 1.0); gl_Position.y = -gl_Position.y; }",
                "#version 150\nin vec2 v; in vec4 c; out vec4 o; uniform sampler2D tex; uniform int textured;\n"
                        + "void main(){ o = textured == 1 ? texture(tex, v) * c : c; }");
        int vao = glGenVertexArrays(), vbo = glGenBuffers();
        glBindVertexArray(vao);
        glBindBuffer(GL_ARRAY_BUFFER, vbo);
        int stride = 8 * 4;
        glEnableVertexAttribArray(0); glVertexAttribPointer(0, 2, GL_FLOAT, false, stride, 0);
        glEnableVertexAttribArray(1); glVertexAttribPointer(1, 2, GL_FLOAT, false, stride, 8);
        glEnableVertexAttribArray(2); glVertexAttribPointer(2, 4, GL_FLOAT, false, stride, 16);
        glUseProgram(prog);
        glUniform2f(glGetUniformLocation(prog, "size"), W, H);
        int uTextured = glGetUniformLocation(prog, "textured");
        glEnable(GL_BLEND);
        glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE, GL_ONE_MINUS_SRC_ALPHA); // keep the framebuffer opaque
        STBImageWrite.stbi_flip_vertically_on_write(true);
        ByteBuffer px = BufferUtils.createByteBuffer(W * H * 4);
        long drawNs = 0;
        int rows = (frames + cols - 1) / cols;
        for (int t = 0; t < ticks; t++) {
            long d0 = System.nanoTime();
            glViewport(0, 0, W, H);
            glClearColor(0.03f, 0.05f, 0.07f, 1f);
            glClear(GL_COLOR_BUFFER_BIT);
            // 1. backdrop
            draw(texBackdrop, uTextured, 0, 0, W, H, 0, 0, 1, 1, 1, 1, 1, 1);
            // 2. sprite frame: one quad, UVs into the sheet (this is all a GIF-like animation costs)
            int f = still ? 0 : t % frames, cx = f % cols, cy = f / cols;
            float su = 1f / cols, sv = 1f / rows;
            draw(texSheet, uTextured, sx, sy, sw, shh, cx * su, cy * sv, (cx + 1) * su, (cy + 1) * sv, 1, 1, 1, 1);
            if (texOverlay != 0) draw(texOverlay, uTextured, 0, 0, W, H, 0, 0, 1, 1, 1, 1, 1, 1);
            // 3. progress bar (the provider owns it; here it fills over the run)
            float p = (t + 1) / (float) ticks;
            if (texOverlay != 0) draw(0, uTextured, 227, 400, 400 * p, 4, 0, 0, 0, 0, 1f, 0.451f, 0f, 1f); // launcher orange #ff7300
            else draw(0, uTextured, 227, 392, 400 * p, 3, 0, 0, 0, 0, 0.878f, 0.439f, 0.235f, 1f);
            glFinish();
            drawNs += System.nanoTime() - d0;
            glReadPixels(0, 0, W, H, GL_RGBA, GL_UNSIGNED_BYTE, px);
            STBImageWrite.stbi_write_png(String.format("%s/t%04d.png", outDir, t), W, H, 4, px, W * 4);
        }
        System.out.printf("ticks=%d frames_in_sheet=%d avg_draw_ms=%.3f (budget at 20 Hz: 50 ms)%n", ticks, frames, drawNs / 1e6 / ticks);
        glfwDestroyWindow(win);
        glfwTerminate();
    }

    static void draw(int tex, int uTextured, float x, float y, float w, float h, float u0, float v0, float u1, float v1, float r, float g, float b, float al) {
        glUniform1i(uTextured, tex == 0 ? 0 : 1);
        if (tex != 0) glBindTexture(GL_TEXTURE_2D, tex);
        FloatBuffer vb = BufferUtils.createFloatBuffer(6 * 8);
        float[][] v = {{x, y, u0, v0}, {x + w, y, u1, v0}, {x + w, y + h, u1, v1}, {x, y, u0, v0}, {x + w, y + h, u1, v1}, {x, y + h, u0, v1}};
        for (float[] q : v) vb.put(q[0]).put(q[1]).put(q[2]).put(q[3]).put(r).put(g).put(b).put(al);
        vb.flip();
        glBufferData(GL_ARRAY_BUFFER, vb, GL_STREAM_DRAW);
        glDrawArrays(GL_TRIANGLES, 0, 6);
    }

    static int load(String path, int[] size) {
        IntBuffer w = BufferUtils.createIntBuffer(1), h = BufferUtils.createIntBuffer(1), c = BufferUtils.createIntBuffer(1);
        ByteBuffer img = STBImage.stbi_load(path, w, h, c, 4);
        if (img == null) throw new IllegalStateException("cannot load " + path + ": " + STBImage.stbi_failure_reason());
        size[0] = w.get(0); size[1] = h.get(0);
        int t = glGenTextures();
        glBindTexture(GL_TEXTURE_2D, t);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, size[0], size[1], 0, GL_RGBA, GL_UNSIGNED_BYTE, img);
        STBImage.stbi_image_free(img);
        return t;
    }

    static int program(String vs, String fs) {
        int p = glCreateProgram();
        for (int k = 0; k < 2; k++) {
            int sh = glCreateShader(k == 0 ? GL_VERTEX_SHADER : GL_FRAGMENT_SHADER);
            glShaderSource(sh, k == 0 ? vs : fs);
            glCompileShader(sh);
            if (glGetShaderi(sh, GL_COMPILE_STATUS) == 0) throw new IllegalStateException(glGetShaderInfoLog(sh));
            glAttachShader(p, sh);
        }
        glBindAttribLocation(p, 0, "pos"); glBindAttribLocation(p, 1, "uv"); glBindAttribLocation(p, 2, "col");
        glLinkProgram(p);
        if (glGetProgrami(p, GL_LINK_STATUS) == 0) throw new IllegalStateException(glGetProgramInfoLog(p));
        return p;
    }
}
