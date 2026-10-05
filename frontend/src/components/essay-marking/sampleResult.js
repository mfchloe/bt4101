/*
 * Example response from POST /api/essays/mark. Used by the
 * "Try it with sample essays" link while the backend is being built.
 */
export const SAMPLE_RESULT = {
  rubric: "G2 rubric",
  // Bands of the G2 rubric, in the same shape as the rubric_bands table
  rubricBands: [
    { criterion: "Content", band: 5, min_mark: 9, max_mark: 10, descriptor: "All aspects of the task are fully addressed and developed in detail" },
    { criterion: "Content", band: 4, min_mark: 7, max_mark: 8, descriptor: "All aspects of the task are addressed with some development" },
    { criterion: "Content", band: 3, min_mark: 5, max_mark: 6, descriptor: "Some aspects of the task are addressed with some development" },
    { criterion: "Content", band: 2, min_mark: 3, max_mark: 4, descriptor: "Some aspects of the task are addressed" },
    { criterion: "Content", band: 1, min_mark: 1, max_mark: 2, descriptor: "Some attempts to address the task" },
    { criterion: "Content", band: 0, min_mark: 0, max_mark: 0, descriptor: "No creditable response." },
    { criterion: "Language", band: 5, min_mark: 17, max_mark: 20, descriptor: "Coherent presentation of ideas, with effective cohesion within and between paragraphs; Vocabulary and grammar structures varied enough to convey shades of meaning; Vocabulary, grammar, punctuation and spelling used mostly accurately" },
    { criterion: "Language", band: 4, min_mark: 13, max_mark: 16, descriptor: "Most ideas coherently presented, with some cohesion within and between paragraphs; Vocabulary and grammar structures sufficiently varied to convey intended meaning; Vocabulary, grammar, punctuation and spelling often used accurately" },
    { criterion: "Language", band: 3, min_mark: 9, max_mark: 12, descriptor: "Some ideas coherently presented, with simple cohesive devices used to aid cohesion within paragraphs; Some attempt at a range of vocabulary and grammar structures; meaning is clear; Vocabulary, grammar, punctuation and spelling used with some degree of control" },
    { criterion: "Language", band: 2, min_mark: 5, max_mark: 8, descriptor: "Ideas coherently presented at sentence level; Simple vocabulary, grammar, punctuation and spelling used mostly appropriately; meaning is generally clear" },
    { criterion: "Language", band: 1, min_mark: 1, max_mark: 4, descriptor: "Some ideas coherently presented at sentence level; A few examples of correct use of simple vocabulary, grammar, punctuation and spelling; meaning is sometimes clear" },
    { criterion: "Language", band: 0, min_mark: 0, max_mark: 0, descriptor: "No creditable response." },
  ],
  essays: [
    {
      id: "sample-1",
      studentName: "Tan Wei Ling",
      source: "ocr",
      text: "Some people think that school uniforms should be removed because it limits how student express themselves. However, I believe uniforms should be kept.\n\nFirstly, uniforms create a sense of equality among students, since everyone wears the same thing regardless of family income.\n\nSecondly, it help student to focus more on study instead of what to wear every morning.\n\nIn conclusion, uniforms should stay because it is good for the school.",
      criteria: [
        {
          name: "Content",
          score: 6,
          max: 10,
          note: "Clear stance with two reasons, but the conclusion does not develop them.",
        },
        {
          name: "Language",
          score: 9,
          max: 20,
          note: "Clear paragraphs, but repeated subject-verb agreement errors and simple word choice.",
        },
      ],
      feedback:
        "Good structure and a clear stance. Your first reason about equality is well explained.\n\nFocus next on subject-verb agreement: “uniforms” is plural, so use “they limit” and “they help”. See the highlighted sentences.\n\nIn your conclusion, restate your two reasons instead of saying uniforms are “good for the school”.",
      annotations: [
        {
          id: "a1",
          type: "grammar",
          quote: "it limits",
          suggestion: "they limit",
          comment:
            "“Uniforms” is plural, so the pronoun and verb should be plural too.",
        },
        {
          id: "a2",
          type: "grammar",
          quote: "how student express",
          suggestion: "how students express",
          comment: "Use the plural “students” when talking about students in general.",
        },
        {
          id: "a3",
          type: "strength",
          quote:
            "uniforms create a sense of equality among students, since everyone wears the same thing regardless of family income",
          comment: "Strong reason, clearly linked to its effect on students.",
        },
        {
          id: "a4",
          type: "grammar",
          quote: "it help student",
          suggestion: "they help students",
          comment: "Subject-verb agreement: “they help”, not “it help”.",
        },
        {
          id: "a5",
          type: "vocabulary",
          quote: "focus more on study",
          suggestion: "focus more on their studies",
          comment: "“Studies” is the more natural noun here.",
        },
        {
          id: "a6",
          type: "content",
          quote: "because it is good for the school",
          suggestion: "because they promote equality and help students focus",
          comment:
            "Vague ending. Restate your two reasons to make the conclusion convincing.",
        },
      ],
    },
    {
      id: "sample-2",
      studentName: "Muhammad Hafiz",
      source: "typed",
      text: "Should students be allowed to use handphones in school? I strongly beleive that they should, but only with clear rules.\n\nMany students need there phones to contact their parents after CCA. Without a phone, parents may worry when their child is late.\n\nPhones can also be a usefull learning tool. Students can search for information quickly during group work.\n\nHowever, some students might play games during lessons. That is why the school should set rules, for example phones must be kept in bags during class.\n\nIn conclusion, phones should be allowed because they help with safety and learning, as long as students follow the rules.",
      criteria: [
        {
          name: "Content",
          score: 8,
          max: 10,
          note: "Addresses a counter-argument; the second reason needs an example.",
        },
        {
          name: "Language",
          score: 13,
          max: 20,
          note: "Logical paragraphing, with a few spelling mistakes and informal words.",
        },
      ],
      feedback:
        "A well-organised essay that considers both sides of the issue. Responding to the counter-argument about games was a strong move.\n\nCheck your spelling carefully (“believe”, “their”, “useful”) and use formal words such as “mobile phones”.\n\nTo strengthen your second reason, give a specific example of how phones help during group work.",
      annotations: [
        {
          id: "b1",
          type: "vocabulary",
          quote: "handphones",
          suggestion: "mobile phones",
          comment: "“Handphone” is informal; prefer “mobile phone” in formal writing.",
        },
        {
          id: "b2",
          type: "spelling",
          quote: "beleive",
          suggestion: "believe",
          comment: "Remember: “i before e except after c”.",
        },
        {
          id: "b3",
          type: "spelling",
          quote: "there phones",
          suggestion: "their phones",
          comment: "“Their” shows possession; “there” refers to a place.",
        },
        {
          id: "b4",
          type: "spelling",
          quote: "usefull",
          suggestion: "useful",
          comment: "The suffix “-ful” has only one “l”.",
        },
        {
          id: "b5",
          type: "content",
          quote: "Students can search for information quickly during group work.",
          comment: "Add a specific example to make this point more convincing.",
        },
        {
          id: "b6",
          type: "strength",
          quote:
            "However, some students might play games during lessons. That is why the school should set rules",
          comment: "Good job acknowledging a counter-argument and answering it.",
        },
      ],
    },
  ],
};
