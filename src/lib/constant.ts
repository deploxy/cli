export const UPLOAD_API_URL = 'https://package.deploxy.com/api/upload';

export const CONFIG_FILE_NAME = '.deploxy.json';

export const NODEJS_RUNTIMES = [
  {
    value: 'nodejs20x',
    label: 'Node.js 20',
    description: 'nodejs20x',
  },
  {
    value: 'nodejs22x',
    label: 'Node.js 22',
    description: 'nodejs22x',
  },
] as const;

export const PYTHON_RUNTIMES = [
  {
    value: 'python3.11',
    label: 'Python 3.11',
    description: 'python3.11',
  },
  {
    value: 'python3.12',
    label: 'Python 3.12',
    description: 'python3.12',
  },
] as const;

export const MEMORY_SIZES_MB = [
  {
    value: 256,
    label: '256 MB',
    description: '256MB',
  },
  {
    value: 512,
    label: '512 MB',
    description: '512MB',
  },
  {
    value: 1024,
    label: '1024 MB',
    description: '1024MB',
  },
  {
    value: 2048,
    label: '2048 MB',
    description: '2048MB',
  },
  {
    value: 4096,
    label: '4096 MB',
    description: '4096MB',
  },
] as const;
