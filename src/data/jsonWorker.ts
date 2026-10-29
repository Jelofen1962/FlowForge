import { detectJsonFields, parseJson } from './jsonFields';
import { parseCsv, parseTextLines } from './formats';

type Request = { input: string; format: 'json' | 'csv' | 'txt' };
type Response = { fields: ReturnType<typeof detectJsonFields> } | { error: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (message: Response) => void;
};

workerScope.onmessage = ({ data }) => {
  try {
    const parsed = data.format === 'json' ? parseJson(data.input)
      : data.format === 'csv' ? parseCsv(data.input)
      : parseTextLines(data.input);
    workerScope.postMessage({ fields: detectJsonFields(parsed) });
  } catch (error) {
    workerScope.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
