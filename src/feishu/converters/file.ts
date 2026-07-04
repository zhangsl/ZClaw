import type { ContentConverterFn } from './types.js';

export const convertFile: ContentConverterFn = (raw) => {
  try {
    const parsed = JSON.parse(raw) as { file_key?: string; file_name?: string };
    const fileKey = parsed.file_key;
    if (!fileKey) {
      return { content: '[文件]', resources: [] };
    }
    const fileName = parsed.file_name ?? '';
    const nameAttr = fileName ? ` name="${fileName}"` : '';
    return {
      content: `<file key="${fileKey}"${nameAttr}/>`,
      resources: [{ type: 'file', fileKey, fileName: fileName || undefined }],
    };
  } catch {
    return { content: '[文件]', resources: [] };
  }
};
