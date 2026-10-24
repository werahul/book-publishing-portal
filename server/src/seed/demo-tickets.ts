import {
  PRIORITY_RANK,
  type Priority,
  type TicketCategory,
  type TicketStatus,
} from '@bookleaf/shared';
import { Book } from '../modules/books/book.model';
import { Counter } from '../modules/tickets/counter.model';
import { InternalNote } from '../modules/tickets/internal-note.model';
import { Message } from '../modules/tickets/message.model';
import { Ticket } from '../modules/tickets/ticket.model';
import { formatTicketNumber } from '../modules/tickets/ticket.service';
import { User } from '../modules/users/user.model';

/**
 * A realistic starting queue: every category and priority, a stale ticket,
 * unassigned and assigned work, resolved/closed history, and replies written in
 * BookLeaf's tone. Ages are relative to seed time so the queue always looks "live".
 * Diya Chatterjee is deliberately left without tickets to demo the empty state.
 */

const ADMIN = 'admin@bookleaf.com';
const SUPPORT = 'support@bookleaf.com';

interface DemoTicket {
  seq: number;
  authorEmail: string;
  bookId: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  category: TicketCategory;
  priority: Priority;
  reasoning: string;
  assignee?: string;
  hoursAgo: number;
  resolvedHoursAgo?: number;
  messages?: { fromEmail: string; hoursAgo: number; body: string }[];
  notes?: { adminEmail: string; hoursAgo: number; body: string }[];
}

export const DEMO_TICKETS: DemoTicket[] = [
  {
    seq: 1,
    authorEmail: 'arjun.malhotra@email.com',
    bookId: 'BK010',
    subject: 'No royalty received in over 6 months',
    description:
      'Turban Tales has been live since September 2024 and my dashboard shows ₹2,464 pending, but I have not received a single royalty payment in more than 6 months. My bank details were added when I signed up. This is really frustrating — please tell me when I will be paid.',
    status: 'open',
    category: 'royalty_payments',
    priority: 'critical',
    reasoning: 'Live title with no royalty paid for 6+ months; pending amount is above the ₹1,000 payout threshold.',
    hoursAgo: 80,
  },
  {
    seq: 2,
    authorEmail: 'rohit.kapoor@email.com',
    bookId: 'BK003',
    subject: "ISBN on Amazon doesn't match my printed copy",
    description:
      "The Amazon India listing for Code & Karma shows a different ISBN from the one printed on the back cover of my author copies. Readers have messaged me asking if it's the same book. Please fix this urgently.",
    status: 'in_progress',
    category: 'isbn_metadata',
    priority: 'high',
    reasoning: 'ISBN mismatch between listing and printed copy — ISBN errors are high priority by policy.',
    assignee: ADMIN,
    hoursAgo: 52,
    messages: [
      {
        fromEmail: ADMIN,
        hoursAgo: 50,
        body: "Hi Rohit,\n\nThank you for flagging this, and I'm sorry for the confusion it has caused your readers. An ISBN mismatch is a serious data issue on our side, and I've escalated it to our production team as a priority.\n\nThey will verify the ISBN registered for Code & Karma (978-93-5XXXX-03-5) against the Amazon India listing and correct whichever record is wrong. You'll hear back from us with a confirmed fix within 48 hours — no action is needed from you in the meantime.\n\nWarm regards,\nAisha\nBookLeaf Author Support",
      },
    ],
    notes: [
      {
        adminEmail: ADMIN,
        hoursAgo: 50,
        body: 'Escalated to production. Likely a stale ISBN from an earlier metadata upload in the Amazon feed — check the feed history before re-pushing.',
      },
    ],
  },
  {
    seq: 3,
    authorEmail: 'meera.nair@email.com',
    bookId: 'BK009',
    subject: 'Author copies arrived with blurry photos',
    description:
      'I received my 20 author copies of Letters from Lakshadweep yesterday. The photographs in chapters 3 and 7 are blurry and a few pages near the end are misaligned. I can share pictures. I was planning to gift these at a launch event next month.',
    status: 'open',
    category: 'printing_quality',
    priority: 'high',
    reasoning: 'Print defects (blurry images, misaligned pages) reported with a time-sensitive launch event.',
    hoursAgo: 6,
  },
  {
    seq: 4,
    authorEmail: 'vikram.joshi@email.com',
    bookId: 'BK007',
    subject: "Book showing 'Currently Unavailable' on Amazon",
    description:
      "The Last Monsoon has been showing 'Currently Unavailable' on Amazon India for about a week. Readers are telling me they can't order it. It is still available on the BookLeaf Store.",
    status: 'open',
    category: 'distribution_availability',
    priority: 'high',
    reasoning: 'A live title is unorderable on its main platform — lost sales until the stock sync is fixed.',
    assignee: SUPPORT,
    hoursAgo: 20,
  },
  {
    seq: 5,
    authorEmail: 'kavita.deshmukh@email.com',
    bookId: 'BK015',
    subject: 'Still in typesetting after 3 weeks',
    description:
      "It's been over three weeks and Raising Roots is still showing as 'Typesetting'. When will it move to the next stage? I'd like to plan the launch.",
    status: 'in_progress',
    category: 'book_status_production',
    priority: 'medium',
    reasoning: 'Production timeline question on a book in Typesetting; no data or payment issue.',
    assignee: SUPPORT,
    hoursAgo: 70,
    messages: [
      {
        fromEmail: SUPPORT,
        hoursAgo: 60,
        body: "Hi Kavita,\n\nThanks for checking in — I understand how important it is to plan your launch. Raising Roots is currently in Typesetting, and the next step is Proofreading, where you'll receive the proofs to approve.\n\nI've asked our typesetting team for an updated timeline and will confirm it here within 48 hours. Once the proofs reach you, a quick round of approvals is the best way to keep things moving.\n\nBest,\nRahul\nBookLeaf Author Support",
      },
      {
        fromEmail: 'kavita.deshmukh@email.com',
        hoursAgo: 30,
        body: 'Thank you Rahul. Looking forward to the update.',
      },
    ],
  },
  {
    seq: 6,
    authorEmail: 'priya.sharma@email.com',
    bookId: null,
    subject: 'Can I update my book description on Amazon?',
    description:
      "Whispers of the Ganges is live and I'd like to refresh the book description on Amazon with some recent reviews. Is that possible after publication?",
    status: 'resolved',
    category: 'general_inquiry',
    priority: 'low',
    reasoning: 'How-to question about metadata edits; no blocking issue.',
    assignee: ADMIN,
    hoursAgo: 120,
    resolvedHoursAgo: 96,
    messages: [
      {
        fromEmail: ADMIN,
        hoursAgo: 118,
        body: "Hi Priya,\n\nYes, absolutely. You can submit metadata updates such as the book description through your dashboard, or simply reply here with the new text and we'll submit it for you. Changes typically reflect on Amazon and the other platforms within 3–5 business days.\n\nWarm regards,\nAisha\nBookLeaf Author Support",
      },
      {
        fromEmail: 'priya.sharma@email.com',
        hoursAgo: 100,
        body: "Perfect, I'll send it through the dashboard. Thanks!",
      },
    ],
  },
  {
    seq: 7,
    authorEmail: 'sneha.kulkarni@email.com',
    bookId: 'BK013',
    subject: 'Cover design — when will I see options?',
    description:
      'Midnight in Mysore is showing the Cover Design stage. When can I expect to see cover options, and can I share some reference images for the look I have in mind?',
    status: 'open',
    category: 'book_status_production',
    priority: 'low',
    reasoning: 'Routine production question at the Cover Design stage.',
    hoursAgo: 3,
  },
  {
    seq: 8,
    authorEmail: 'farhan.sheikh@email.com',
    bookId: 'BK014',
    subject: 'Royalty amount seems low',
    description:
      "I've sold 156 copies of Ghazal of the Forgotten but my total royalty is only ₹3,120. Could you explain how this is calculated?",
    status: 'closed',
    category: 'royalty_payments',
    priority: 'medium',
    reasoning: 'Royalty calculation question; payments are up to date.',
    assignee: ADMIN,
    hoursAgo: 240,
    resolvedHoursAgo: 190,
    messages: [
      {
        fromEmail: ADMIN,
        hoursAgo: 230,
        body: "Hi Farhan,\n\nThank you for asking — it's a fair question and we're happy to be fully transparent. Your royalty is 80% of the net profit on each copy, where net profit is the MRP (₹250) minus printing cost, platform commission (Amazon/Flipkart) and shipping. For Ghazal of the Forgotten that works out to ₹20 per copy, so 156 copies × ₹20 = ₹3,120, all of which has been paid out.\n\nIf you'd like, we can share a line-by-line breakdown by platform — just reply here.\n\nWarm regards,\nAisha\nBookLeaf Author Support",
      },
      {
        fromEmail: 'farhan.sheikh@email.com',
        hoursAgo: 200,
        body: 'That makes sense, thank you for the clear explanation.',
      },
    ],
  },
  {
    seq: 9,
    authorEmail: 'kavita.deshmukh@email.com',
    bookId: 'BK016',
    subject: "Why haven't I received my royalty of ₹850?",
    description:
      "My dashboard shows ₹850 pending for The Nagpur Notebooks but I haven't received any payment yet. Is there a problem with my account?",
    status: 'open',
    category: 'royalty_payments',
    priority: 'medium',
    reasoning: 'Pending amount is below the ₹1,000 payout threshold, so it rolls over — expected behaviour, needs explaining.',
    hoursAgo: 26,
  },
  {
    seq: 10,
    authorEmail: 'ananya.reddy@email.com',
    bookId: 'BK005',
    subject: 'When will I receive my first royalty?',
    description:
      'Between Two Temples was published in July 2024 and the dashboard shows ₹2,546 pending, but nothing has been paid so far. When should I expect my first payout?',
    status: 'open',
    category: 'royalty_payments',
    priority: 'high',
    reasoning: 'First payout never made on a title published over a year ago; pending is above the threshold.',
    hoursAgo: 40,
  },
];

const hoursAgo = (now: number, h: number) => new Date(now - h * 60 * 60 * 1000);

/** Inserts demo tickets that don't exist yet (by ticket number). Returns how many were created. */
export async function seedDemoTickets(now = Date.now()): Promise<number> {
  const emails = [...new Set(DEMO_TICKETS.flatMap((t) => [t.authorEmail, t.assignee, ...(t.messages ?? []).map((m) => m.fromEmail), ...(t.notes ?? []).map((n) => n.adminEmail)]))].filter(
    (e): e is string => Boolean(e),
  );
  const users = new Map(
    (await User.find({ email: { $in: emails } }, { email: 1, role: 1 }).lean()).map((u) => [u.email, u]),
  );
  const books = new Map((await Book.find({}, { externalId: 1 }).lean()).map((b) => [b.externalId, b._id]));

  const userFor = (email: string) => {
    const user = users.get(email);
    if (!user) throw new Error(`Demo ticket references unknown user ${email}`);
    return user;
  };

  let created = 0;
  for (const demo of DEMO_TICKETS) {
    const ticketNumber = formatTicketNumber(demo.seq);
    if (await Ticket.exists({ ticketNumber })) continue;

    const createdAt = hoursAgo(now, demo.hoursAgo);
    const lastMessage = demo.messages?.at(-1);
    const lastActivityAt = hoursAgo(now, Math.min(demo.hoursAgo, lastMessage?.hoursAgo ?? Infinity, demo.resolvedHoursAgo ?? Infinity));

    const ticket = new Ticket({
      ticketNumber,
      author: userFor(demo.authorEmail)._id,
      book: demo.bookId ? books.get(demo.bookId) : null,
      subject: demo.subject,
      description: demo.description,
      status: demo.status,
      category: demo.category,
      categorySource: 'ai',
      priority: demo.priority,
      priorityRank: PRIORITY_RANK[demo.priority],
      prioritySource: 'ai',
      ai: {
        state: 'done',
        classification: {
          category: demo.category,
          priority: demo.priority,
          reasoning: demo.reasoning,
          model: 'seed',
          at: createdAt,
        },
      },
      assignee: demo.assignee ? userFor(demo.assignee)._id : null,
      lastActivityAt,
      lastReplyRole: lastMessage ? userFor(lastMessage.fromEmail).role : null,
      resolvedAt: demo.resolvedHoursAgo !== undefined ? hoursAgo(now, demo.resolvedHoursAgo) : null,
      createdAt,
      updatedAt: lastActivityAt,
    });
    // timestamps:false keeps the back-dated createdAt/updatedAt instead of "now".
    await ticket.save({ timestamps: false });

    for (const m of demo.messages ?? []) {
      const sender = userFor(m.fromEmail);
      const at = hoursAgo(now, m.hoursAgo);
      await new Message({
        ticket: ticket._id,
        sender: sender._id,
        senderRole: sender.role,
        body: m.body,
        createdAt: at,
        updatedAt: at,
      }).save({ timestamps: false });
    }
    for (const n of demo.notes ?? []) {
      const at = hoursAgo(now, n.hoursAgo);
      await new InternalNote({
        ticket: ticket._id,
        admin: userFor(n.adminEmail)._id,
        body: n.body,
        createdAt: at,
        updatedAt: at,
      }).save({ timestamps: false });
    }
    created += 1;
  }

  // New tickets must continue after the demo numbers.
  const maxSeq = Math.max(...DEMO_TICKETS.map((t) => t.seq));
  await Counter.updateOne({ _id: 'ticket' }, { $max: { seq: maxSeq } }, { upsert: true });
  return created;
}
