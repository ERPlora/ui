/**
 * Operations used only by the SDK's own tests. Projects augment `Operations` the same way from
 * their generated OpenAPI types (`declare module "@erplora/ui/sdk" { interface Operations {…} }`).
 */
import type {} from "./operations";

export interface TestLine {
  id: string;
  text: string;
}

export interface TestItem {
  id: string;
  name: string;
  lines: TestLine[];
}

export interface TestItemPage {
  items: TestItem[];
  total: number;
}

declare module "./operations" {
  interface Operations {
    "test.item.list": { input: { search?: string; status?: string[]; done?: boolean; limit?: number }; output: TestItemPage };
    "test.item.detail": { input: { id: string }; output: TestItem };
    "test.item.add_line": { input: { id: string; text: string; client_line_id: string }; output: TestLine };
    "test.item.delete": { input: { id: string }; output: undefined };
    "test.session.me": { input: undefined; output: { user: string } };
  }
}
