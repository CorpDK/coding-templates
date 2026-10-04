const emptyRows = () => Promise.resolve([] as unknown[]);

export interface CodegenDbStub {
  select: () => {
    from: () => {
      where: (where: unknown) => Promise<unknown[]>;
      innerJoin: () => {
        where: (where: unknown) => Promise<unknown[]>;
      };
      for: () => {
        where: (where: unknown) => Promise<unknown[]>;
      };
    };
  };
  insert: () => { values: () => { returning: () => Promise<unknown[]> } };
  update: () => { set: () => { where: () => { returning: () => Promise<unknown[]> } } };
  delete: () => { where: () => { returning: () => Promise<unknown[]> } };
  transaction: <T>(fn: (tx: CodegenDbStub) => Promise<T>) => Promise<T>;
}

export const db: CodegenDbStub = {
  select: () => ({
    from: () => ({
      where: () => emptyRows(),
      innerJoin: () => ({
        where: () => emptyRows(),
      }),
      for: () => ({
        where: () => emptyRows(),
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
  transaction: async (fn) => fn(db),
};
