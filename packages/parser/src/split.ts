/**
 * Split a .quizv.md file into raw text blocks.
 *
 * The file format is:
 *   <quiz-meta frontmatter>
 *   ---
 *   <question frontmatter>
 *   ---
 *   <question body>
 *   ---
 *   <question frontmatter>
 *   ---
 *   <question body>
 *   ...
 *
 * Splitting on `\n---\n` produces:
 *   [meta-opening-delimiter + meta-content, q1-frontmatter-content, q1-body, q2-frontmatter-content, q2-body, ...]
 *
 * This function returns:
 *   [metaBlock, q1Block, q2Block, ...]
 *
 * where metaBlock = the first raw piece (includes opening `---`),
 * and each qBlock = frontmatter-content + `\n---\n` + body (reassembled for gray-matter).
 */
export function splitBlocks(content: string): string[] {
  const pieces = content
    .split(/(^|\n)---(\n|$)/g)
    .filter((_, i) => i % 3 === 0)
    .map(b => b.trim())
    .filter(b => b.length > 0)

  if (pieces.length === 0) return []

  // First piece is the meta block (includes the leading `---` of the YAML front matter)
  const metaBlock = pieces[0]!
  const rest = pieces.slice(1)

  // Remaining pieces come in pairs: [frontmatter-content, body]
  // Reassemble each pair into a proper `---\nfrontmatter\n---\nbody` block
  if (rest.length % 2 !== 0) {
    throw new Error(
      `Malformed .quizv.md file: expected an even number of blocks after the meta section, got ${rest.length}`,
    )
  }

  const questionBlocks: string[] = []
  for (let i = 0; i < rest.length; i += 2) {
    const frontmatter = rest[i]!
    const body = rest[i + 1]!
    // Reassemble so gray-matter can parse it correctly
    questionBlocks.push(`---\n${frontmatter}\n---\n\n${body}`)
  }

  return [metaBlock, ...questionBlocks]
}
