const DIRECTIVE = new RegExp([
  String.raw`^\s*(eslint|eslint-disable|eslint-enable|eslint-disable-line|eslint-disable-next-line|global|globals)\b`,
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
  return comment.type === 'Line' && WARNING.test(comment.value) && (!next || next.loc.start.line !== comment.loc.end.line + 1);
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
    return {
      Program() {
        const comments = context.sourceCode.getAllComments();
        comments.forEach((comment, index) => {
          if (comment.type === 'Shebang' || DIRECTIVE.test(comment.value)) return;
          if (isLoneWarning(comment, comments[index + 1])) return;
          if (isPublicApiDoc(comment, filename, publicApi)) return;
          report(comment);
        });
        for (const comment of context.sourceCode.ast.templateBody?.comments ?? []) report(comment);
      },
    };
  },
};
