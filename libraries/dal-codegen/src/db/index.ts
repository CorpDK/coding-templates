import type { SQL } from "drizzle-orm";

let lastWhere: SQL | undefined;

const emptyRows = () => Promise.resolve([] as unknown[]);

export function resetCodegenDbMock(): void {
  lastWhere = undefined;
}

export function getCodegenDbLastWhere(): SQL | undefined {
  return lastWhere;
}

export const db = {
  select: () => ({
    from: () => ({
      where: (where: SQL) => {
        lastWhere = where;
        return emptyRows();
      },
      innerJoin: () => ({
        where: (where: SQL) => {
          lastWhere = where;
          return emptyRows();
        },
      }),
      for: () => ({
        where: (where: SQL) => {
          lastWhere = where;
          return emptyRows();
        },
      }),
    }),
  }),
  insert: () => ({
    values: () => ({
      returning: emptyRows,
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => ({
        returning: emptyRows,
      }),
    }),
  }),
  delete: () => ({
    where: () => ({
      returning: emptyRows,
    }),
  }),
  transaction: async <T>(fn: (tx: typeof db) => Promise<T>): Promise<T> => fn(db),
};
