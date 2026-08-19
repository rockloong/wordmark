// 让 TS 识别 ?raw 导入(Vite 内置 ?raw 会把文件内容作为字符串返回)
declare module '*.css?raw' {
  const content: string;
  export default content;
}
