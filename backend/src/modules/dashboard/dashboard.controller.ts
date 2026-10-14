
import type { ServerResponse } from 'node:http';

export function dashboardController(response: ServerResponse): void {
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  response.end(
    JSON.stringify({
      data: {},
    }),
  );
}
