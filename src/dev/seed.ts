/**
 * Dev-only demo data. Load the app with `?seed=demo` (dev server only) to wipe local data and
 * fill it with a goal, logged videos (cards due today), actions and an unfinished video.
 */
import * as repo from '../db/repo';
import { deleteAllData } from '../db/backup';
import { dayStartPlus, now } from '../lib/dates';

export async function seedDemo(): Promise<void> {
  await deleteAllData();
  const t = now();
  const daysAgo = (n: number) => t - n * 86_400_000;

  const goalId = await repo.createGoal(
    { title: 'Learn Python for data analysis', why: 'So I can automate the weekly sales report instead of doing it by hand.' },
    { activate: true },
    daysAgo(10),
  );
  await repo.createGoal({ title: 'Get better at public speaking' }, { activate: false }, daysAgo(30));

  const v1 = await repo.createVideo(
    {
      url: 'https://www.youtube.com/watch?v=vmEHCJofslg',
      youtubeId: 'vmEHCJofslg',
      title: 'Pandas Tutorial: DataFrames in Python',
      channel: 'Demo Channel',
      thumbnailUrl: 'https://i.ytimg.com/vi/vmEHCJofslg/hqdefault.jpg',
      goalId,
      purpose: 'Understand how to load and filter a CSV with pandas',
    },
    daysAgo(3),
  );
  await repo.addNote(v1, 95, 'read_csv takes a path or URL', daysAgo(3));
  await repo.addNote(v1, 410, 'df.loc for labels, df.iloc for positions', daysAgo(3));
  await repo.logVideo(
    v1,
    {
      brainDump: 'DataFrames are tables. You load them with read_csv, filter rows with boolean masks, pick columns with brackets.',
      takeaways: [
        { cue: 'What is the difference between df.loc and df.iloc?', answer: 'loc selects by label, iloc selects by integer position.' },
        { cue: 'How do you keep only rows where sales > 100?', answer: 'df[df["sales"] > 100] — a boolean mask inside the brackets.' },
      ],
      action: { text: 'Load last month’s sales CSV and filter to orders over $100', dueDate: dayStartPlus(t, -1) },
      openQuestions: ['When should I use query() instead of a mask?'],
      rating: 5,
    },
    dayStartPlus(t, -1) + 3_600_000 * 20, // logged yesterday evening → cards due today
  );

  const v2 = await repo.createVideo(
    {
      url: 'https://www.youtube.com/watch?v=txMdrV1Ut64',
      youtubeId: 'txMdrV1Ut64',
      title: 'GroupBy: split, apply, combine',
      thumbnailUrl: 'https://i.ytimg.com/vi/txMdrV1Ut64/hqdefault.jpg',
      goalId,
      purpose: 'Learn to summarise sales per region',
    },
    daysAgo(2),
  );
  await repo.logVideo(
    v2,
    {
      brainDump: 'groupby splits the table by a key, applies an aggregation like sum, and combines the results.',
      takeaways: [{ cue: 'What are the three steps of groupby?', answer: 'Split by key, apply a function, combine the results.' }],
      action: { text: 'Make a per-region revenue table with groupby', dueDate: dayStartPlus(t, 0) },
      openQuestions: [],
      rating: 4,
    },
    dayStartPlus(t, -1) + 3_600_000 * 21,
  );

  const v3 = await repo.createVideo(
    {
      url: 'https://www.youtube.com/watch?v=GPVsHOlRBBI',
      youtubeId: 'GPVsHOlRBBI',
      title: 'Merging and joining DataFrames',
      thumbnailUrl: 'https://i.ytimg.com/vi/GPVsHOlRBBI/hqdefault.jpg',
      goalId,
      purpose: 'Combine the sales and customers tables',
    },
    t,
  );
  void v3;

  // A finished action with a reflection, for the Done tab.
  const done = await repo.listOpenActions();
  if (done[0]) await repo.completeAction(done[0].id, 'Worked — took 10 minutes instead of an hour.', daysAgo(0));

  await seedHistory(goalId, daysAgo);
}

/** A few weeks of older videos and reviews so Library, Stats and weak spots have something to show. */
async function seedHistory(goalId: string, daysAgo: (n: number) => number) {
  const speaking = (await repo.listGoals()).find((g) => g.title.startsWith('Get better'))!.id;
  const older: [string, string, string, number, string, [string, string][]][] = [
    ['HAnw168huqA', 'Python lists vs tuples', goalId, 40, 'Know when to use each', [['When is a tuple better than a list?', 'When the data should not change, e.g. a record or a dict key.']]],
    ['rfscVS0vtbw', 'Reading CSV files with pandas', goalId, 26, 'Load messy CSVs', [['How do you skip junk rows in read_csv?', 'skiprows= and comment= options.'], ['How do you parse dates on load?', 'parse_dates=["col"].']]],
    ['ZDa-Z5JzLYM', 'Speak with confidence: the pause', speaking, 19, 'Stop rushing', [['Why pause before a key point?', 'It signals importance and gives the audience time to focus.']]],
    ['8DvywoWv6fI', 'Python functions in depth', goalId, 9, 'Write cleaner helpers', [['What does *args collect?', 'Extra positional arguments, as a tuple.']]],
  ];
  for (const [yt, title, g, ago, purpose, cards] of older) {
    const id = await repo.createVideo(
      { url: `https://www.youtube.com/watch?v=${yt}`, youtubeId: yt, title, goalId: g, purpose, thumbnailUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` },
      daysAgo(ago + 1),
    );
    await repo.addNote(id, 120, 'Key idea around here', daysAgo(ago + 1));
    await repo.logVideo(
      id,
      {
        brainDump: `Main points I remember from "${title}" — written from memory before checking notes.`,
        takeaways: cards.map(([cue, answer]) => ({ cue, answer })),
        action: { text: `Try one idea from "${title}"`, dueDate: daysAgo(ago - 2) },
        openQuestions: [],
        rating: ago > 20 ? 4 : 5,
      },
      daysAgo(ago),
    );
    const bundle = (await repo.getVideoBundle(id))!;
    // Review each card a few times; some get forgotten (lapses → weak spots, retention < 100%).
    for (const [i, c] of bundle.cards.entries()) {
      const pattern: ('again' | 'good' | 'hard')[] = g === speaking ? ['again', 'good', 'again'] : i === 0 ? ['good', 'again', 'good'] : ['good', 'good'];
      let day = ago - 1;
      for (const rating of pattern) {
        if (day < 0) break;
        await repo.reviewCard(c.id, rating, daysAgo(day));
        day = Math.max(0, day - 4);
      }
    }
    if (ago > 15) await repo.completeAction(bundle.actions[0].id, 'Done.', daysAgo(ago - 3));
  }
}
