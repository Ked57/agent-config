const DIRECTIVE = new RegExp([
  String.raw`^\s*eslint-(?:disable(?:-next-line|-line)?|enable|env)(?:\s|$)`,
  String.raw`^\s*eslint\s+[^\s:+]+\s*:`,
  String.raw`^\s*globals?\s+[A-Za-z_$][\w$]*(?:\s*:\s*(?:writeable|writable|readable|readonly|false|true|off))?(?:\s*,\s*[A-Za-z_$][\w$]*(?:\s*:\s*(?:writeable|writable|readable|readonly|false|true|off))?)*(?:\s+--\s+\S.*)?\s*$`,
  String.raw`^\s*@ts-(expect-error|ignore|nocheck)\b`,
  String.raw`^\s*prettier-ignore\s*$`,
  String.raw`^\s*(istanbul|v8|c8) ignore\b`,
  String.raw`^\s*[#@]__[A-Z_]+__\s*$`,
  String.raw`^\s*webpack[A-Z]\w*:`,
  String.raw`^\s*@vite-ignore\s*$`,
  String.raw`^/ <reference\b`,
  String.raw`^\s*@jsxImportSource\b`,
  String.raw`^\s*SPDX-License-Identifier:`,
  String.raw`^!`,
  String.raw`^[\s*]*@license\b`,
  String.raw`^# source(Mapping)?URL=`,
].join('|'));

const WARNING = /^ WARNING: \S/;

function isPublicApiDoc(comment, filename, publicApi) {
  return comment.type === 'Block' && comment.value.startsWith('*') && publicApi.some((part) => filename.includes(part));
}

function isLoneWarning(comment, next) {
  const singleLine = comment.type === 'Line' || (comment.type === 'HTMLComment' && comment.loc.start.line === comment.loc.end.line);
  return singleLine && WARNING.test(comment.value) && (!next || next.loc.start.line !== comment.loc.end.line + 1);
}

export default {
  meta: {
    type: 'suggestion',
    schema: [{ type: 'object', properties: { publicApi: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }],
    messages: {
      prose: 'Remove this comment: rename or restructure the code so it explains itself, and put the reason in the commit message. Only a single-line `// WARNING: <hazard>` may stay.',
    },
  },
  create(context) {
    const publicApi = context.options[0]?.publicApi ?? [];
    const filename = context.filename.replaceAll('\\', '/');
    const report = (comment) => context.report({ loc: comment.loc, messageId: 'prose' });
    const visit = (comments) => {
      comments.forEach((comment, index) => {
        if (comment.type === 'Shebang' || DIRECTIVE.test(comment.value)) return;
        if (isLoneWarning(comment, comments[index + 1])) return;
        if (isPublicApiDoc(comment, filename, publicApi)) return;
        report(comment);
      });
    };
    return {
      Program() {
        visit(context.sourceCode.getAllComments());
        visit(context.sourceCode.ast.templateBody?.comments ?? []);
      },
    };
  },
};
