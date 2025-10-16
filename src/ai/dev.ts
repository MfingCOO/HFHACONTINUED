'use server';
import 'dotenv/config';
import {glob} from 'glob';

/**
 * Lists all flow files that should be loaded by the dev server.
 * This is used by the Genkit CLI.
 */
export async function lazyLoad() {
  const flowFiles = await glob('src/ai/flows/*.ts', {
    cwd: process.cwd(),
  });
  const toolFiles = await glob('src/ai/tools/*.ts', {
    cwd: process.cwd(),
  });
  const otherFiles = await glob('src/ai/*.ts', {
    cwd: process.cwd(),
  });
  const filesToLoad = flowFiles
    .concat(toolFiles)
    .concat(otherFiles)
    .filter((path) => !path.endsWith('dev.ts'));
  for (const file of filesToLoad) {
    // The path from glob starts with 'src/', so we replace it with '@/'
    // to create a valid module path that the Next.js builder can resolve.
    const modulePath = file.replace(/^src/, '@');
    await import(modulePath.substring(0, modulePath.length - 3));
  }
}
