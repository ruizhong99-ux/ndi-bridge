declare module "ffi-napi" {
  const ffi: {
    Library(path: string, functions: Record<string, [string, string[]]>): Record<string, (...args: any[]) => any>;
  };
  export default ffi;
}

declare module "ref-napi" {
  const ref: {
    types: Record<string, any>;
    NULL: Buffer;
    refType(type: any): any;
    alloc(type: any, value?: any): Buffer;
    allocCString(value: string): Buffer;
    address(buffer: Buffer): number;
    writePointer(buffer: Buffer, offset: number, value: Buffer): void;
    isNull(buffer: Buffer): boolean;
  };
  export default ref;
}

declare module "ref-struct-di" {
  const StructFactory: (ref: any) => (fields: Record<string, any>) => any;
  export default StructFactory;
}
