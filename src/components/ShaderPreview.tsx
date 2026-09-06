import { useEffect, useRef } from 'react';
import '@/styles/components/shader-preview.css';

interface Props {
  background?: boolean;
}

export default function ShaderPreview({ background = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const gl = (canvas.getContext('webgl', { antialias: false }) ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

    if (!gl) {
      canvas.remove();
      return;
    }

    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    const fragmentSource = `
      precision highp float;
      uniform float u_time;
      varying vec2 v_texCoord;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.71, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0; float amplitude = 0.5;
        mat2 rotation = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p); p = rotation * p; amplitude *= 0.5;
        }
        return value;
      }
      void main() {
        vec2 p = vec2(v_texCoord.x * 4.2, v_texCoord.y * 0.42);
        float t = u_time * 0.04;
        vec2 q = vec2(fbm(p + t), fbm(p + vec2(1.0)));
        vec2 r = vec2(
          fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * t),
          fbm(p + 4.0 * q + vec2(8.3, 2.8) + 0.126 * t)
        );
        float f = fbm(p + 4.0 * r);
        vec3 color = mix(vec3(0.998, 0.998, 1.0), vec3(0.975, 0.98, 0.99), f);
        color = mix(color, vec3(0.0, 0.48, 1.0), clamp(length(q) - length(r), 0.0, 1.0) * 0.035);
        color = mix(color, vec3(0.4, 0.9, 1.0), clamp(pow(f, 3.0), 0.0, 1.0) * 0.04);
        color += 0.018 * sin(10.0 * f + u_time * 0.12);
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };

    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      canvas.remove();
      return;
    }

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const time = gl.getUniformLocation(program, 'u_time');

    let frame = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    };

    const render = (now: number) => {
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (time) gl.uniform1f(time, now * 0.001);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!motionQuery.matches) frame = requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    render(0);

    const onMotion = () => {
      cancelAnimationFrame(frame);
      render(performance.now());
    };
    motionQuery.addEventListener('change', onMotion);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motionQuery.removeEventListener('change', onMotion);
    };
  }, []);

  return (
    <section
      className={`shader-preview${background ? ' shader-preview--background' : ''}`}
      aria-label="Bluebook fluid technology shader preview"
    >
      <canvas ref={canvasRef} data-shader-canvas aria-hidden="true" />
      {!background && (
        <div className="shader-preview__label">
          <p>BLUEBOOK / SHADER STUDY</p>
          <h1>Fluid technology field</h1>
          <span>Standalone preview — not yet connected to the landing page.</span>
        </div>
      )}
    </section>
  );
}
