import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  sourcemap: true,
  target: 'es2022',
  format: 'esm',
};

const configs = [
  // Service worker (background)
  {
    ...shared,
    entryPoints: ['src/background/service-worker.ts'],
    outfile: 'dist/background.js',
  },
  // Content script
  {
    ...shared,
    entryPoints: ['src/content/content-script.ts'],
    outfile: 'dist/content.js',
  },
  // Side panel
  {
    ...shared,
    entryPoints: ['src/panel/panel.ts'],
    outfile: 'dist/panel.js',
  },
  // Standalone engine (for OpenQuizzer consumption)
  {
    ...shared,
    entryPoints: ['src/engine/index.ts'],
    outfile: 'dist/engine/quizzer-core.js',
  },
];

async function build() {
  if (watch) {
    const contexts = await Promise.all(configs.map(c => esbuild.context(c)));
    await Promise.all(contexts.map(ctx => ctx.watch()));
    console.log('Watching for changes...');
  } else {
    await Promise.all(configs.map(c => esbuild.build(c)));
    console.log('Build complete.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
