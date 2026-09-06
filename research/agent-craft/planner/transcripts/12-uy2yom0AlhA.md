A key/value dictionary in memory is a database.
For a lot of programs it's the right one. Write it to a file on exit, read it 
back on startup, and that's still right. It stops being right for three reasons, and 
every database feature answers one of them. First, the data outgrows memory. Something has to choose what stays in RAM, and 
find one record on disk without reading all of it. Second, more than one person uses it at once.
Two writes hit the same row, a reader arrives halfway through, and something 
decides what each of them sees. Third, the power can fail mid-write, and the data 
has to come back whole instead of half applied. Pages, the buffer pool and indexes 
exist for the first constraint. The second gives you MVCC and isolation levels, and the third is the whole 
reason for the write-ahead log. Name the constraint a feature answers 
and it stops looking arbitrary. The problem is that most advice 
built on this map still fails you. Search why your Postgres query is 
slow and you get thousands of answers. One answer says add an index, another 
says your index is the problem, and a third says a cache will make it worse.
None of it tells you which situation you're in. Take four fixes that got tried.
Someone added an index, and the query got slower. They doubled the instance size and 
bought back four hundred milliseconds. They put Redis in front, and the 
hit rate came back at four percent. They added a read replica, and it 
fell forty-five seconds behind. None of that was bad luck.
Every one was predictable from what the engine was doing, so the 
question is which mechanism, in what order. Seven parts, built from the bottom up. Storage internals is the ground floor: 
pages, the buffer pool, the log, MVCC. Indexes is the biggest section, because 
that's where nearly all the leverage lives. Pagination, and why page five hundred costs 
five hundred times what page one costs. Query execution: three join algorithms, and how 
one bad row estimate wrecks everything above it. Transactions and isolation: what MVCC buys you, 
and the anomaly that survives Repeatable Read. Read scaling: replicas, lag, caching, and the 
line where partitioning stops and sharding starts. Schema design: building from access patterns, 
and changing a live table without locking it. Indexes don't make sense without pages, 
and joins don't make sense without indexes. Watch it in order, and if you only watch 
part of it, make it the bottom four, because everything above them depends on them. It's still just a map until you 
run a real query through it. All seven layers run through one query. You've written this, or close 
enough that it doesn't matter. Recent orders for one customer, 
newest first, twenty of them. It runs against one table, orders.
Two hundred million rows, forty columns, about eight hundred gigabytes and growing.
Fifty thousand reads a second at peak, two thousand writes, all filtering on a customer 
and a time range, with eleven indexes on it. We follow it seven times: to the disk 
and back, made fast, paged properly, joined to the customer, run 
while someone writes to it, served fifty thousand a second, 
and finally questioned as a design. Same query every time, each time 
standing further away from it. That's two hours, so let me be 
straight about what this is. This is long and chaptered, 
so treat it as something to scrub through rather than sit through.
After every section there's a question with a real pause before the answer.
Try them, because watching someone answer a question you didn't attempt 
teaches you almost nothing. Every chapter is marked, so you 
can come back to any one of them. Some things are deliberately not here.
CAP and consistency models, consensus, failover, distributed transactions, deep 
write tuning, and engine comparisons. Each is its own video, and none of 
them stick until this part is solid. Everything above the bottom layer waits, 
because none of it makes sense yet. Down to the disk. Module one is storage internals. It sits under two constraints, data bigger 
than memory and power failing mid-write. So what is a table, physically, on the disk? It's one long file chopped into 
fixed-size blocks called pages. A page is eight kilobytes by default, 
and Postgres always works in whole pages. The whole file of them has a 
name too, and it's the heap. The cost shows up when you 
ask for something small. Ask for one narrow column, maybe forty 
bytes of it, and Postgres still pulls the whole eight kilobyte page into memory, 
because there's no smaller move available. Our table is eight hundred gigabytes, 
which is about a hundred million pages. Everything else in this video 
is a way to touch fewer of them. Which leaves the obvious question: how 
does Postgres find one row inside a page? Near the front of every page sits an 
array of slots called line pointers, each recording where a tuple 
starts and how long it is. A row's address is two numbers, the 
page it sits on and which slot it uses, and Postgres calls that pair the ctid. Then the page compacts to close a gap. The tuple slides somewhere new, its slot 
stays put, and the address never changes. Slots are never moved until they're freed, 
which is what makes the address usable. Across an update that address changes, so 
identify rows by primary key, never by ctid. What we still haven't seen is the empty 
middle of the page the tuple slid through. Here is one page in 
cross-section, 8,192 bytes wide. The first 24 bytes are the page header. Just behind it, line pointers march 
forward, four bytes each, one per tuple. The tuples fill from the opposite 
end, backwards toward the pointers. Free space is whatever is left in the 
middle, and both sides eat into it. The header tracks both edges of that gap, where 
the pointers stop and where the tuples begin. Every tuple carries a 23-byte header 
on most machines, so a table of tiny rows is never as small as you'd guess. Keep writing and the two fronts 
close until the gap is a sliver. Then along comes a value wider than what's left. A tuple can never span two pages, so 
Postgres acts long before one fills. The line is two kilobytes, normally, a quarter 
of the page and earlier than people expect. The limit is on the whole row, not one 
column, so medium fields add up and cross it. Once it crosses, Postgres compresses 
the widest fields in place, and anything that squeezes under stays put.
What's still too wide moves out to a separate table, and that's TOAST, the 
oversized-attribute storage technique. A pointer takes its place, so the 
row keeps its shape and its ctid. Four storage strategies are settable 
per column, and EXTENDED, the default, allows both compression and moving out.
EXTERNAL is the one to remember, moving the value out without compressing 
so you read pieces cheaply. One read of that row has turned into two. Two fetches instead of one, 
and on average that still wins. Postgres keeps recently used 
pages in a fixed amount of memory, and with wide values still in the 
rows, a page holds few of them. Move them out and the main table shrinks, so more 
rows fit in the same memory, and sorts shrink too. One measured example in the 
docs, a table of web pages, kept about ten percent of the data 
in the main table and ran no slower. The second fetch only happens 
when you read that column, so a query naming its columns pays nothing extra. The cost moved from always to when you 
ask, and select star asks once per row. All of which assumes we know 
what a page fetch costs. Not every page fetch costs the same, 
so reach one pile of pages two ways. Reading them in file order is a sequential scan, every page sitting right next to the last.
The cost climbs at a predictable rate. Reach those same pages one at a time, and 
nothing about the last fetch helps the next. The work is identical, and the cost is a different 
category, not a worse point on one scale. That gap is a setting inside the planner, 
the part of Postgres that plans your queries. A scattered page is priced four times 
a sequential one by random_page_cost. Those numbers decide whether an index gets used. That four is Postgres's default guess, and it dates back to disks that had to 
physically move to reach a scattered page. The hardware moved, and 
Postgres 18 caught up with it. When a backend can keep only one read outstanding, every scattered fetch waits out 
its trip before the next starts. Postgres 18 added asynchronous IO, so 
a backend queues many reads at once. The device overlaps them, so the same 
pages in the same order come back sooner. Each read costs the same, 
and the waiting collapses. The two IO concurrency defaults moved to sixteen. The release note explains it in one line: 
this more accurately reflects modern hardware. The gap is still real, just narrower, and nothing 
here changes how many pages a query needs. The cheapest read is the one 
that never leaves memory. That memory is a fixed grid of page 
slots called the buffer pool, sized by a setting called shared_buffers.
It ships at 128 megabytes. Above it sits a second cache 
the operating system keeps. A missing page may still be there, 
so the read never reaches the device. The documented starting point 
is a quarter of system memory. Past forty percent more is unlikely to help, because that starves the 
operating system cache underneath. When the grid fills, choosing 
what leaves is a clock sweep. A pointer circles the slots, knocks 
every usage counter down by one, and takes only the ones already at zero.
A page in regular use survives several passes. A dirty slot gets written 
out first, which costs more. The grid stays full from here, so which 
pages stay decides everything about latency. Take one query, one index, one table, and run 
it twice with nothing in the SQL changing. The first time, every page it needs is 
already in the grid, so it finishes fast. The plan shows it under BUFFERS, which 
counts what each step hit and read. In Postgres 18, ANALYZE turns that on. Run it again with the grid holding 
other pages, and what it needs is gone. Every miss goes out and comes 
back, and the same query drags. Call it ninety-nine percent hits 
against sixty, and the SQL never moved. So the question is which pages 
were resident when it ran. A miss in shared_buffers may 
still not reach the device, because the operating system 
cache can be holding the page. Reads are explained now, and none of 
this has survived the power going out. The change starts in memory, where one page 
in the grid is modified and marked dirty. Postgres appends a small record describing 
it to the write-ahead log, the WAL. An fsync pushes that record to permanent 
storage, forcing the write out of memory. The instant that fsync lands, the commit is 
acknowledged, and the page is still dirty. Data files may only change after the 
records describing them are durable. That page goes down later, at a checkpoint, 
when all the dirty ones are flushed. One fires every five minutes, or 
sooner if the log nears a gigabyte. The writes are spread out 
rather than dumped at once. Pull the power and memory is 
gone, but the log is on disk. On restart everything after the last checkpoint 
replays, and that commit comes back with it. The log is durable before the data 
is, which changes what a write costs. A single transaction touches ten rows, and they 
land on ten pages scattered all over the table. Flushing all ten at commit would put ten 
scattered writes on the critical path. Instead the commit needs one 
append at the end of the log. The log only grows in one direction, so syncing 
it costs far less than flushing the data pages. The ten pages stay dirty and 
go down at the next checkpoint. It costs size, because full_page_writes logs the whole page the first time it 
changes after a checkpoint. It guards against a page 
caught half-written by a crash. Volume spikes right after 
each checkpoint, then falls. What is left is one ordered stream of every 
change, and another machine could follow it. So what actually happens when you run an UPDATE? Every row carries two hidden 
fields you never declared. xmin is the transaction that wrote this copy, 
and xmax stays zero until something deletes it. A reader arrives with its own transaction number, checks those stamps, and decides 
whether it can see this copy. Then the update runs, and the 
original is never touched. Postgres writes a new copy further 
down the page with its own xmin, then stamps the original's xmax with the same number.
Both still exist, and each one is a row version. That's what saves the older 
reader: it started first, so that xmax belongs to a transaction it can't 
see yet, and it still reads the old version. Two readers, same row, two 
different answers, both right. And a stamped xmax doesn't mean the row is dead, 
which is what trips people up in production. Keeping both versions means a 
reader never waits for a writer, and a writer never waits for a reader. The reader has its copy and the writer is building 
another, so there is nothing to fight over. Overwrite in place instead, 
and one side has to wait. The trade is paid in space. Every old version of the row stays right 
there on the page, and once no running transaction can still see one, it's a dead tuple.
They pile up, and a seq scan reads every one. The pass that clears them is vacuum, 
and it marks their slots reusable. It almost never returns that space to the 
operating system, so the file does not shrink. That wasted space is bloat, and it goes away 
only if something comes along and clears it. Vacuum is what comes along, and 
autovacuum runs it in the background. Reclaiming space is one of four documented jobs. The other three hold up the rest of this video. The first clears dead tuples.
The second refreshes the statistics the planner uses to guess how many rows match.
The third keeps the visibility map, a bit per page marking it visible to every transaction, 
so an index-only scan can skip the table. The fourth freezes old rows, 
stamping them permanently visible, which protects against wraparound, the 
transaction id counter running out. Autovacuum falling behind is 
never only a disk problem. Estimates go stale, index-only scans stop skipping 
the table, and the counter climbs, all at once. Postgres records the last finished pass per table. Some of that reclaim work is index cleanup, 
and one kind of update never creates any. Eleven indexes point at one row here. Change an indexed column and every one needs 
a new entry, eleven writes for one update. Change a column no index covers instead. Postgres writes the new version on the same page 
under the old one and redirects the old slot. No index hears about it, all eleven stay 
untouched, and the index write count is zero. That is a HOT update, short for heap-only tuple, and it costs no index work 
however many indexes exist. Two things have to hold: no indexed column 
changed, and room on the page for the new version. Break either one and all eleven fire.
One exception: BRIN indexes don't count, because they summarize ranges 
instead of pointing at rows. Heap pages pack to a hundred percent by default, so you reserve room by lowering 
the table's fillfactor to eighty. Vacuum keeps up on a table like this, which 
raises what happens where it does not. Where vacuum falls behind, this is the countdown.
Transaction ids are thirty-two bits, so the counter holds about four billion 
values and then wraps to zero. When it wraps, past transactions look like 
future ones, and their rows go invisible. Freezing prevents it, stamping a row older 
than everything so it stays valid forever. Every table needs vacuuming at least once every 
two billion transactions, half the counter. Miss it, and at forty million transactions 
left, Postgres warns in the log. Ignore that, and under three million it 
stops handing out new transaction ids. Reads keep working, but nothing new can write, 
so the site goes read-only rather than down. Postgres stops early on purpose, leaving you 
room to run the freeze that clears the backlog. That covers the heap, which leaves one question: 
how do you find a single row inside it? The answer is a B-tree, a sorted 
structure you walk down to find a key. It starts as one page of keys in order. A node holds as many keys as fit in its page, 
and when the next will not fit, it splits. The middle key moves up into a new node, 
the root page, where searches start. Keep inserting and splits keep going, 
pushing depth up a level at a time. The entries live in the 
bottom row, the leaf pages. Only a root split changes depth, 
and every leaf drops together. A page holds a few hundred narrow keys, so each 
node points at a few hundred children, the fanout. Four levels then cover billions of rows. Finding any one costs about four page 
reads, out of a hundred million pages. Every leaf sits the same distance down, 
and they turn out to be connected. They are, in key order, so from one leaf you 
can step to the next without going back up. That's what lets you ask for a whole 
range of keys instead of just one. You pay four page reads to reach the first match, 
then one page for every leaf you walk after that. Sorting comes free too, because the entries were 
written in ascending order, with nulls at the end. Walk the chain forward and rows come out 
sorted, and backward gives you the reverse. So a query asking for the first twenty 
rows stops the walk after twenty, and there's nothing left to sort at the end.
The rest of the chain never gets read at all. Duplicate keys collapse into one key 
with a sorted list of row pointers. Three later modules cash in this structure, and before them, there's another 
way to build a storage engine. A B-tree writes in place, walking down 
to the leaf and changing the entry there, so every write lands as a random write. An LSM, short for log-structured 
merge tree, refuses to do that. Writes land in a sorted buffer in memory, 
the memtable, and nothing on disk is touched. When the memtable fills, it goes to disk 
as one sorted file, written sequentially. Those files pile up, so one 
lookup may have to check several. Compaction merges those files 
down into bigger ones and drops the versions nothing needs any more.
So one write can end up on disk ten times or more before it settles, 
and that's write amplification. Neither shape is correct, they pay 
at different times, and knowing which you run tells you what to expect.
There's a whole video on DynamoDB if you want the LSM side properly, and 
everything after this is Postgres. Module one is done, so let's test it. An update changes one non-indexed 
column, on a table with eleven indexes. The answer is C, a HOT update.
No indexed column changed, so no index entry moves, and the 
new version fits on the page. B is the popular pick, and it's right for a 
different update, where an indexed column changes. D assumes an update in place, 
which Postgres never does. Eleven indexes cost nothing on that 
update, and that will not hold everywhere. Your table is three times bigger on disk than 
the rows in it, so where did the space go? The answer is B. Those are dead tuples that 
vacuum has not reclaimed. The other three are real, they're 
the wrong size or the wrong object. Index size is not table size, 
TOAST makes the main table smaller, and a fillfactor of eighty holds back 
twenty percent, nowhere near three times. The better question is why vacuum did not 
reclaim it, and that waits for module five. Module two is indexes. One constraint this time, the data is bigger 
than memory, and it's the longest module. So which query is actually slow?
The log won't tell you, because the same query arrives fifty thousand times 
a second with a different value each time. pg_stat_statements is an extension that keeps a 
running tally for every statement the server runs. It replaces each literal 
value with a symbol like $1, so all fifty thousand copies 
collapse into one entry. Turning it on needs a restart, 
which catches people out. Fifty thousand query texts collapse into one row.
It carries the call count, the total and mean time, the rows returned, and the 
two buffer counters from module one. Those numbers are cumulative since the last reset, and the view tracks a limited number of 
statement shapes, evicting the rarest. Nine rows, and the column you sort 
by decides which problem you find. Sort by mean time and a reporting query 
tops the list at three seconds a run. Twice a day, that's six seconds of database time.
The eight millisecond query runs fifty thousand times a second, four hundred seconds of 
execution every second across many backends. Sort by total time and the reporting 
query falls out of the top five. Mean finds the complaint, total finds 
where the time went, so start with total. Total time isn't the same as waste, since a 
fast query run constantly lands on top too, and rows per call is what separates them. That eight milliseconds is an 
average over fifty thousand runs, so what did the slow ones look like? That row is an average, so the executions that 
hurt sit out in a tail it keeps no trace of. EXPLAIN shows how Postgres ran a query, and 
auto_explain runs it for you in the background. log_min_duration is the millisecond mark 
an execution has to pass to get logged. It ships at minus one, catching 
nothing, and zero catches everything. The plan you run by hand belongs to 
your parameters and your cache state, and the one that crawled overnight 
is gone unless something caught it. log_analyze charges per-node timing 
on every statement the server runs, including the fast ones that never get logged, 
which the docs call an extremely negative impact. Switching log_timing off buys most of that 
back and costs you the per-node clocks. Keep the threshold high and timing 
off, and there's a plan to read. Every index in Postgres sits in its 
own file, separate from the heap. There's no clustered index, so even the 
primary key points at the table from outside. About four page reads walk down the tree 
to a leaf entry holding a key and a ctid. The index knows where the 
row is, not what it says. An ordinary index scan is two hops: find the 
entry, then read the heap page it points at. That's five page reads for one row, not four. The descent walks the tree in key order, and the 
heap hop lands wherever the row sits, scattered. You pay the descent once and the heap hop per row. Twenty rows are quick and forty thousand are 
not, and the second hop is what you'd skip. An index-only scan skips that 
second hop, and it needs two things. A B-tree always supports it, and the query 
can only name columns the index stores. For each row it returns, the scan also checks 
the visibility map bit for that row's heap page. One bit covers a whole page, so a recent 
write clears it for every row there. A set bit returns the value from the index, and 
an unset one sends that row to the heap anyway. A plan can say index-only scan and 
still visit the heap for some rows. Vacuum sets those bits, so half of this 
decision lives outside your schema. Writes unset them again, and it's the 
newest pages that a recent window reads. Our query selects forty columns, 
so it can never get one, and the index's columns are the next decision. INCLUDE gives an index entry two halves: the searchable key on the left, 
non-key payload on the right. A search can only grip the key. A condition on payload can't narrow 
the scan, so it lands as a filter. The result comes out of both halves.
An index-only scan returns payload contents without touching the table, as 
long as the visibility map is current. Last scene we made total a third key 
column, just to get the index-only scan. Put it in the payload instead and you keep 
that scan, with a key still two columns wide. Payload columns don't count 
toward uniqueness either. Payload rides in every leaf 
entry, so the index gets wider. An index on two columns is a composite 
index, sorted by the first, then the second. The usual advice is to lead 
with the highest selectivity, the column removing the most rows.
The documentation says something narrower. Equality on the leading columns limits 
how much of the index is scanned. One customer id collapses the search 
to one run, their whole order history. Then one inequality gets the same power, 
on the first column with no equality. Our date range sits there, and trims 
both ends of that run to thirty days. Anything further right gets checked 
inside the index, which saves heap visits but doesn't shorten the walk.
Put the date behind an unconstrained column and Postgres walks forty thousand 
entries to return seventeen hundred. An index can contain your column, use it, and 
still scan everything it would without it. Which one you write first is not cosmetic. Both indexes hold the same 
entries and take the same space, so the only difference is which name comes first. Customer first, date second, and the rule collects 
both halves: the equality picks one customer's band, the range trims it to thirty days.
It stops after twenty entries. Swap them and the date leads, so the 
range does the limiting and the walk covers thirty days of every customer.
The customer id sits on the right, saving table visits without 
necessarily shrinking the walk. That window holds about eight million orders, 
seventeen hundred of them this customer's. Twenty of theirs turn up after 
about ninety thousand entries. A customer with three orders this 
month never fills the twenty, so that walk runs the whole window. Two single-column indexes get the rows, and lose the order, so a sort appears 
and the limit stops bounding the walk. The right order narrowed the search, 
and that walk came out already sorted. That walk came out in date order because 
a B-tree stores its entries ascending, nulls last, arranged as the rows went in. Read the leaves forward and 
the output is ascending, read them backward and it's descending, 
which is what our query wanted. The plan says index scan 
backward, with no sort node. Rows arrive in the right order, so 
the walk can stop at the twentieth. Raise the limit and the pages read climb with it, 
until the range runs out before the limit does. An index on customer alone 
stores those equal keys once, followed by a sorted list of physical addresses. That list is in disk order, so 
date order brings a sort back. The leading-column rule picked 
up an exception in Postgres 18. Plenty of queries never 
supply that leading equality. Postgres 18 added the skip scan, which uses the 
index anyway, searching it once per leading value. Take an index on status and date, with six 
statuses, and a query restricting only the date. Before 18 nothing narrowed it, so 
the planner read the whole table. The planner supplies the missing 
equality, once per distinct status, so six narrow searches run under the old rule. Six distinct values is six descents, and 
a million customers is a million descents. No threshold appears in the documentation, 
so the planner prices both plans and picks. Low cardinality, few distinct values, 
is what makes the hopping worth it. Column order matters as much as ever, 
and these indexes keep getting wider. The same documentation that gives 
you that rule also says to go easy on composite indexes, and that past 
three columns they're rarely helpful. An index node is a page, holding as many 
entries as fit, so a wider key fits fewer. Lower fanout means more leaf pages and eventually 
another level, which every lookup pays for. Writes pay too, in more bytes per 
entry and more write-ahead log. The escape hatch is real: a table serving one query shape and 
nothing else can justify five columns. A column earns its key slot by the shape of its 
constraint, equalities first, then one range. The two-column index is back, correct and 
matching the query, and the plan skips it. The index is there, correct and usable, and the planner priced both 
plans and took the cheaper one. A sequential read costs the whole table 
in order whatever the predicate says, so that price is flat.
The index plan pays for scattered pages, more as more rows match, 
so it climbs and crosses that line once. Widen the predicate a step at a time, and the 
estimate climbs until the node name changes. Postgres holds no threshold, 
and any percentage you've been quoted came from someone else's database.
pg_stats adds another input: a histogram of the column's values, and a correlation 
figure that favours an ordered column. Turn enable_seqscan off and the planner shows 
you the plan it rejected, and it costs more. That's a blunt tool for looking, 
not a setting to leave off. Lower random_page_cost and the crossing point 
moves, without a single row of your data changing. The planner was right here, as 
long as its row estimate was. Take a query with two conditions, 
one on country, one on currency. Each matches about two percent of the 
table, and both estimates are right. Combining them goes wrong, because the planner normally assumes the 
two have nothing to do with each other. It multiplies the fractions and 
predicts eighty-four thousand rows. Every Canadian order is billed in Canadian 
dollars, so the second condition removes nothing. The real answer is four million, 
fifty times the prediction, and columns that move together fail one 
way, underestimating what comes back. The planner is under-informed rather than broken. It holds a summary of country and a separate one 
for currency, nothing that describes the pair. Country and currency, city and postcode, 
almost every schema has a pair, and there is a supported way 
to tell the planner the truth. CREATE STATISTICS is one statement, and it describes columns as a 
group rather than one at a time. It doesn't take your word for 
the relationship, it measures it. ANALYZE samples the table and works out 
how strongly each column decides the other. The documented example is a zip codes table, 
and the two directions are different numbers. Zip decides city every time, which scores a 1.0, and city decides zip only 
about 42 percent of the time. That asymmetry is the point, because the 
planner needs a degree in each direction. With it, the estimate matches 
what the query returns. Dependencies only apply to equality 
and IN lists, never to ranges. Statistics were one reason the plan was 
wrong, and the cost constants are the other. The planner prices plans using a handful 
of settings that ship with fixed defaults, and those defaults decide whether it 
reads your index or the whole table. The one nobody looks at is effective_cache_size, the planner's guess at how much of 
your data is already sitting in cache. The higher it is, the cheaper index scans 
look, and it ships at four gigabytes. The machine under our table has a hundred 
and twenty-eight gigabytes of memory. Every index scan still gets priced 
as if only four of those were cache. Raising the setting doesn't allocate anything, 
it only changes what the planner believes. Four gigabytes against a hundred and twenty-eight 
is the bigger lie, wrong by more than thirty times, and wrong in the direction that 
makes the planner distrust your index. The other setting has a reputation 
that the manual doesn't back up. Everyone gets told to lower random_page_cost, 
because four supposedly dates from spinning disks. The advice often works, and 
that reason is not the manual's. The manual says random access is normally much 
more expensive than four times sequential. Four is lower on purpose, because most 
random reads are assumed to be cached. The discount is already inside the number, so the question is your cache-hit 
mix against the one it assumed. Fully cached in memory, the manual 
says set both page costs equal. In a heavily cached database it 
says to lower both page costs, and dropping only the random one is different. With a poor hit mix, the default 
assumed better than you get. A plan can also change with none of these touched. Nothing was tuned there.
The statement was prepared once and sent six times, and 
the sixth came back different. The first five runs each get their own plan, 
built with your actual parameter in hand. Postgres averages the 
estimated cost of those five. Then it builds a generic plan, one 
made without knowing the value, and compares its price against that average.
The comparison is estimates against estimates, because nothing here measures 
how long anything took. If it wins, the statement keeps that plan, 
with no deploy and nothing in your logs. pg_prepared_statements counts how often each 
kind was chosen, so you can watch it land. Five is what the docs call the current rule, and 
plan_cache_mode lets you take the decision away. The plan in front of you may 
not be the plan you were handed. Reading a plan is three habits, matching three 
quantities: rows first, then pages and memory. Every node carries two numbers: the rows the 
planner expected, and the rows it actually got. The docs tell you to compare them, 
and admit that an exact match is rare. A mismatch is not a diagnosis, so read bottom up. The deepest node that blew out is where it 
went wrong, and everything above inherits it. Here the estimate was three rows 
against eleven hundred and eighty-four. Divide rather than subtract: a 
hundred against a thousand fails as badly as a hundred thousand against a million. A node that runs more than once reports 
rows per run, so multiply by the loops. That tells you the shape was wrong.
It says nothing about where the pages came from. Habit two is pages.
Two runs of the same query can produce identical plans, down to the row counts, 
and one still takes fifty times longer. One line in the plan tells you why.
BUFFERS shows where each step got its pages: a hit was already in the buffer 
pool, and a read had to come from disk. You get four counters back: 
hit, read, dirtied and written. They count every access, so a page 
touched forty times counts forty times. Planning gets its own set of counts, and a big number up there means the planner 
did real work before your query even started. Postgres 18 turns BUFFERS on with ANALYZE, but 
on older servers you still have to ask for it. That was one index, and 
real queries often use two. There's an index on each of the two columns, 
and neither one narrows much on its own. Status matches six hundred thousand 
rows, warehouse five hundred thousand. Postgres can use both at once, in a bitmap scan.
It walks each index and marks the location of every row that matched onto a bitmap in 
memory, without opening a single table page. Then it combines the two bitmaps, keeping the rows marked in both for 
an AND, or in either one for an OR. That leaves about fifteen hundred rows, 
and nothing it dropped ever gets fetched. Only then does it go to the table, fetching 
the survivors in one pass over the heap. And the multiplication that 
misfired earlier works here, because status and warehouse really are unrelated. What comes back is an unordered pile of 
rows, and the query asked for them in order. That pass is cheap because it walks the 
heap in physical order, page after page. A bitmap records which rows matched and 
nothing else, with no room for a key order. The rows come back in the order they 
sit on disk, old ones mixed with recent. Whatever ordering the two indexes had 
is gone before the heap is touched. The query still asked for the newest first, so 
Postgres puts a sort on top of the bitmap scan. Given those two indexes, that is the right plan. The limit stops helping, because 
a sort cannot emit its first row until it has read everything below it. Twelve hundred rows get sorted 
so twenty can come back. A B-tree already holds its 
entries in ascending order, which is the real answer to one 
composite index versus two singles. That bitmap has been sitting in 
memory, one entry per matching row. The space it gets is work_mem, the memory 
budget for one operation in one query. There is a cheaper form, one bit per page, 
saying only that the page holds something. That covers sixty four gigabytes 
of disk in about a megabyte. When the exact bitmap would outgrow 
work_mem, Postgres converts pages to the cheap form and carries on.
Nothing errors and nothing is logged. The bill lands on the heap, where every row on a converted page gets 
rechecked against your WHERE clause. Rows that fail get discarded 
after they have been read. The tell is the exact and lossy block counts, because the recheck line itself 
shows up even on healthy plans. And these indexes still have to get 
built, on a table that's taking writes. Writes land on this table at two thousand 
a second, reads running alongside. A plain CREATE INDEX locks the table against 
writes and builds the index in one scan. That single scan is why it is the fastest 
build, since nothing changes underneath. Reads keep working throughout, which is 
what makes this confusing while it happens. Every insert, update and delete stops, 
and they do not fail, they wait. Ten minutes on eight hundred gigabytes leaves 
over a million write statements stacked up, each holding a connection.
When the pool runs out, reads fail on a lock they never touched. Nothing broke, someone ran a migration, and 
there is a version that keeps writes flowing. Add CONCURRENTLY and the barrier lifts, because 
the build now runs while writes keep landing. Postgres charges for that in two ways. The build scans the table twice.
The first pass indexes everything present when it started, the second 
folds in whatever changed meanwhile. It also waits for every existing 
transaction that could use the index. That wait is on transactions, not the table, so a long transaction elsewhere 
can hold the build indefinitely. The statement cannot run 
inside a transaction block, which is what most migration 
tools wrap every migration in. When the build fails it does not roll 
back, it leaves an index marked INVALID. That index is ignored for queries 
because it might be incomplete, and every write still maintains it.
Drop it and retry, or reindex it concurrently. The hard part was never the fix, it was noticing.
An index can also go bad with nothing failing. Those gaps come from what happens 
when a leaf page runs out of room. The next entry won't fit, so the 
page divides in two, a page split, and where the line falls decides everything. When the keys arrive in no particular order, splitting down the middle is the right call, 
because the next one could land on either side. Later keys top both halves up, so the index 
settles around sixty five to seventy percent full. Feed it keys that only ever 
increase, like a timestamp, and every new entry belongs at the far right.
Split down the middle and the left half sits half empty forever, since 
nothing will arrive to fill it. Postgres spots that pattern and packs 
the old page nearly full instead, leaving the new one empty for what's coming. With the default fillfactor of ninety, leaf 
pages end up about ninety percent full. Nothing changed but the order the keys arrived in.
Sixty five percent means a third more leaf pages, all competing for the buffer pool.
And that difference has been measured. The change shipped with measurements, written 
into the commit message by the person who made it. Both of Postgres's own pg_depend 
catalog indexes came out at least twenty percent smaller under its regression tests. At least is the commit's 
word, so twenty is a floor. TPC-C benchmark indexes were 
consistently about forty percent smaller. The gap tracks how much of each workload's 
inserts arrive in order already. Same schema, same rows, only 
the split placement changed. Forty percent fewer index pages frees buffer pool space and shortens range scans, 
though lookups cost the same. A random primary key has a 
price, and a standard says so. That value is a UUIDv4, and five in 
a row share nothing at the front. This is the unpredictable 
column from two scenes back. RFC 9562 says UUID versions that aren't time 
ordered have poor database index locality, so values created one after another don't 
land anywhere near each other in the index. UUIDv7 is the same standard's answer, a UUID 
whose leading bits are a Unix timestamp. Values created one after another sort that way 
too, so they land side by side in the index. Everything else survives, since both versions are a hundred and twenty eight bits and both 
come from the client without coordination. In Postgres every index is secondary, so a scattered key scatters the 
index and leaves the table alone. Index size has one more input, 
and you did not choose it. An index on status holds two hundred 
million entries and four distinct values. Each carries its own copy of that key. Postgres merges each run of duplicates 
into one posting list by default, the key held once above a 
sorted array of addresses. A low-cardinality index comes out 
smaller than the arithmetic predicts, because storage scales with 
row pointers rather than rows. It is unavailable on a few types, 
including jsonb, the binary JSON column type, and on INCLUDE indexes.
The INCLUDE case is permanent, so a covering index can quietly 
outgrow the plain one it replaced. A key above a sorted list of its rows 
is what one whole index type is made of. The operator in your WHERE 
clause picks the index type, along with whether the 
answer must come back sorted. B-tree answers the widest shape, 
equality and ranges on anything sortable. Every index in this module so far has been one. Looking inside an array or a jsonb 
document needs GIN, an inverted index with one entry per value in there.
Hash handles simple equality and nothing else. GiST is a framework rather than one index, and it unlocks nearest neighbour, ordering by 
distance and stopping after the nearest few. SP-GiST covers structures that are not 
balanced trees, quadtrees and radix trees. A partial index is keyed on the 
predicate, covering only the rows its condition selects, so it 
is smaller and takes fewer writes. A time range over a huge append-only table goes to 
BRIN, which has a prerequisite most people skip. BRIN keeps one summary for every 
block of consecutive pages, holding just the smallest and 
largest value in that block. The size follows how many pages 
you have, not how many rows. A hundred million pages, grouped a 
hundred and twenty eight at a time, comes to under a million summaries. An index that small is cheap to read end to end, and it lets Postgres skip whole stretches 
of table that can't hold a match. It only works when the column lines 
up with the order rows sit in on disk, so neighbouring rows hold similar values. Scatter those values and every summary covers 
the whole range, so nothing can be skipped. Check the correlation in pg_stats before you build 
one, because near zero means BRIN can't help you. And matching the shape gets 
harder once the column holds text. Search is one word in the spec 
and three questions to the engine: starts with, contains, and mentions. A B-tree answers a prefix pattern, but outside 
the C locale the default operator class will not. Add text_pattern_ops and it does, so this 
is the index that quietly does nothing. A leading wildcard leaves nothing to 
descend, so that goes to a trigram index, which needs no left anchor. A pattern with no trigrams 
in it scans the whole index. Neither understands words, so 
mentioning one runs on a tsvector, the text cut into root words.
GIN is preferred there, because a GiST text index is lossy and sends 
you to the table to discard false matches. One word needs three mechanisms, 
and the ordering still has to match. A B-tree stores entries ascending with nulls last, so a forward scan gives that order 
and a backward scan the reverse. Scan direction is one bit for the whole index, so two columns come back both 
ascending or both descending. Ask for status ascending 
with newest first inside it, and neither direction produces that.
The index still serves the WHERE clause, so the planner uses it and sorts 
on top, killing the early exit. Declare the second column descending in 
the index itself, and the sort disappears. The mirror declaration works too. Null placement has to match too, and 
its default flips with direction, last ascending and first descending.
Indexes have been pure upside for a whole module. Every index in this module made one read 
cheaper and every write more expensive. There are eleven on this table, and it's 
taking two thousand writes a second. Change one row and all eleven have to be 
updated, and that cost lands on every write. And if no query ever uses one of them, 
you're paying that cost for nothing. An update only stays cheap if no indexed 
column changed and the page still has room. Index another column and it 
drops out of that cheap group. BRIN is the exception, since a 
summary index has nothing to move. Fill that page up and the same 
update fires all eleven anyway, without a single indexed column changing. So two completely different problems 
land you with the same bill. Delete a parent row and Postgres 
scans the child table for references, because declaring a foreign 
key doesn't build an index. Delete a thousand parents in a cleanup 
job and that's a thousand scans. Eleven is the number to carry out of this module, and there's still one problem 
left on the read side. First, three questions.
A query wants one tenant, the last thirty days, newest first, twenty rows.
Which index? The answer is B, tenant first, then the timestamp. The descent lands on one tenant, 
and those rows are already in order. A is the trap, and it's right for a query 
wanting the newest rows across every tenant. Two indexes find the rows, and 
then a sort on top kills the limit. An INCLUDE column is payload, and 
payload can't supply the order. Equality first, range last, and the sort 
comes free from the order you chose. A two terabyte events table, insert-only, 
with rows arriving in timestamp order. You query it by time range, so B-tree or BRIN? The answer is C, because two 
options say BRIN and one says why. In-order arrival keeps every block summary narrow, so a time range rules almost all of them out.
B picks the right index for the wrong reason. A is right once that ordering 
breaks, and D has it backwards. Physical order decides this, not size, 
and the orders table churns too much. The index exists, it matches the 
query, and the planner won't use it. Which two would you check first, and why? All four are real, so this one is a ranking. C first, because one catalog query says whether a failed build left an unusable index.
It still costs you on every write. A second, because a wrong row count 
makes every cost after it wrong. B scales a number that must be right 
first, and D is the planner being right. Rank by what the check costs and 
by how much it would explain. Module three is pagination. Same constraint as before, the data is 
bigger than memory, and this module is short. How many ways are there to ask for the next page? Six names are in use, and underneath 
them one request has two moves. The first is OFFSET, a count of 
the rows in front of your page. The server sorts the result, produces 
those rows, then throws them away. The second is keyset pagination, which swaps that 
count for a WHERE clause on the last row you saw. The request becomes twenty rows after this one. A page number becomes an offset 
before the database ever sees it. Cursor pagination is keyset with 
the keys hidden inside a token. Both need a total order, because without 
ORDER BY you get an unpredictable subset, and the docs say that is not a bug.
Counting past rows sounds cheap. Take the whole order list, ten thousand 
rows deep, with a perfect index on it. The descent to the first matching entry touches 
four pages, and that holds at any depth. Then the walk starts, and the 
length of the walk is the offset. Ten thousand index entries 
go past, each fully checked, each fetched from the heap, and each thrown away. Ten thousand and twenty entries walked, 
ten thousand discarded, twenty returned. That's five hundred and one units of work 
for every row that reaches the client. The documentation says the rows skipped by 
an OFFSET still have to be computed inside the server, and that a large 
OFFSET might be inefficient. None of this shows outside the database, 
and the cost moves with the page number. Page one walks twenty entries, page 
five hundred walks ten thousand, and page five thousand walks a hundred 
thousand for the same twenty rows. The line is straight because the 
operation is defined as dropping that many rows, so the work is the offset.
No index and no other engine bends it. You only reach page five 
hundred by scrolling there. The person deepest in your feed has used the 
product most, and they get your worst latency. The average hides it, because almost 
every request is for a shallow page. A flat median tells you 
most people are on page one. Before you replace the mechanism, look 
at how wide those discarded rows are. Every row it threw away arrived 
whole, all forty columns, because the index and the table sit apart, 
so reading a row means visiting both. So page over the index and ask 
for nothing but the ids, with the id carried along as a payload column.
That walk shouldn't touch the table at all. Then an outer query takes the twenty 
ids that survived and fetches the full rows by primary key, twenty visits 
to the table instead of a million. The walk itself didn't change, 
it's still a million entries to return twenty, so page fifty thousand still 
costs a thousand times what page fifty costs. Throwing those rows away is cheaper now, 
but you're still throwing them away. The discard goes away when 
the page carries the last row's sort key instead of a number, and 
keyset turns the skip into a predicate. A B-tree can seek to a 
predicate and never to a count. The descent drops root to leaf and lands between 
two entries, four pages on a tree this size. From there the walk reads forward twenty 
entries, because the limit says twenty. Six pages touched altogether, 
and the counter stops. Page one and page fifty thousand cross the 
same four levels and read the same leaf pages, so both plans report the same buffer count. Deduplication packs a leaf where a key repeats, 
storing it once beside the rows that share it, and an index carrying payload 
columns gets none of that. There is no predicate for page five 
hundred, so keep every thousandth row's sort key in a side table, jump to the 
nearest one, and walk the short remainder. The mechanism is that small, and there 
are two ways to write the boundary wrong. The boundary carries both fields now, and the pair in brackets is a different 
query from two column tests joined by AND. Row comparison runs left to right and 
stops at the first unequal or null pair, so that pair decides and the rest is never read. A null landing there makes the answer unknown, 
so paging on a nullable column drops those rows. The pair version admits every 
earlier row whatever its identifier, while the AND version also demands a 
smaller identifier and drops the rest. The page still comes back full, 
twenty rows in the right order. From outside it is a user who cannot 
find an order they know exists. Those rows are gone, because every later 
boundary only moves that ceiling down. That is one way to lose rows, 
and the common one comes next. Sort this queue by status, 
a column with five values, and the sort fixes where each group sits 
with nothing ordering the rows inside. Run it twice and each run may 
arrange that group differently, so a row can land on both pages or neither. Both pages come back with 
twenty rows and no error. The documentation calls that 
not a bug, but a consequence of SQL never promising any particular order.
Keyset inherits it: a strict boundary skips the rest of the group, and a non-strict 
one returns the same twenty forever. End the sort with a unique column, in the sort, the boundary and the index, 
so every row has one position. Get those two right and the token 
is only these values in a wrapper. Those values have to survive 
the gap between requests, and HTTP remembers nothing, so they go 
back to the client wrapped in a token. Decode one and there is a version number, a timestamp and an identifier, and the 
version says which sort it came from. Anyone can decode one, so sign it if a forged 
boundary would reach data it should not. Ask for twenty-one rows and return twenty, and the extra one answers whether another page 
exists, for one index entry and no second query. Going backwards flips the comparison and the 
sort, then reverses the twenty before rendering, and its boundary is the page's first 
row, so a page carries two tokens. The pages work now, and the number 
beside them is a separate problem. That number is its own query, and swapping 
offset for keyset leaves it untouched. A filtered count visits every matching row, 
so it costs whatever scan the filter implies. A third of two hundred million rows are shipped, no index helps at that share, and the count 
reads eight hundred gigabytes for one integer. The same count over one customer's last thirty days comes back from the 
index in under a millisecond. There is no stored total, only reltuples, an 
estimate the catalog keeps and vacuum refreshes. Scale it by the filter's share and the header 
reads nearly sixty million, without a scan. Below that, stop at a thousand and one rows 
and render a thousand plus, or render nothing. One mechanism is left, and it is 
for a job with nobody waiting on it. That job has no user waiting and no 
pages, and neither mechanism fits. A server-side cursor runs the query once inside 
a single transaction and keeps it running, so a page is a FETCH against 
something already in progress. Every fetch reads the same snapshot, so a row updated mid-run arrives 
as the cursor first saw it. What you pay is the xmin horizon, 
the line below which dead row versions can be cleaned up, 
and an open transaction pins it. Vacuum removes nothing newer, even 
on tables the export never reads. WITH HOLD frees the horizon by copying the whole 
result out first, the export written twice. Right for an export, wrong for a web request, and that open transaction has 
a price this video returns to. Park that open transaction, because 
module three closes with three questions. A feed sorts by score, thousands of 
rows tie, and keyset uses score alone. The answer is B. Some rows come back twice 
and others never come back. Page one ends at score one hundred, and a 
strict less-than skips every other row there. Less-than-or-equal sends back 
rows page one already delivered. Neither version errors, and 
both pages come back fast. The boundary has to name one row, 
so the sort needs a unique tail. Product wants numbered pages to five hundred, over two hundred million rows.
Two of the four hold up. The answers are B and C, anchor keys 
or measuring how deep anyone pages. Keep the sort key of every thousandth row, 
seek the nearest anchor, skip the rest. Any page number then costs the same, 
and anchors serve one sort order. A fails on the total, because printing 
the page count means counting the table. A page number asks for a 
position, so give it a key. A nightly export pages through five million rows with OFFSET and takes six hours.
Two of these fixes are real. The answers are A and C, either 
keyset or one streaming cursor. Five thousand iterations discard about twelve 
and a half billion rows to deliver five million. An index changes none of it, because skipped 
rows still get computed inside the server. The cursor reads once and streams, 
holding a transaction open all night. The number to check is the 
actual row count under the Limit. Module four is query execution. Same constraint as the last two 
modules, the data is bigger than memory. So how does Postgres actually join two tables? Beside orders sits customers, 
a million and a quarter rows. The first strategy is the nested loop, scanning 
the right table once for every row in the left. Without an index that is 
twenty sweeps of a million rows, which the docs call very time consuming. The next sentence rescues it: an index on the right turns each sweep into 
one descent, keyed by the current left row. When a node runs more than once, the printed rows and time are averages per 
execution, so multiply by loops. Read the loops value first, 
though buffers is already a total. Nested loop is not the bad one, and a small outer side over an indexed 
inner is the fastest join available. Drop the LIMIT and that outer side becomes 
eight million rows, with nothing warning you. Both slow plans here were 
forced with planner switches, a diagnostic and never a setting to ship. That outer side is usually not small, 
and the loop stops working once it grows. The second strategy is the hash join, which scans one relation into a 
hash table keyed on the join column. The smaller side goes in once, and 
the plan shows which side that was. Then the other relation streams past, each row's key finding its matches.
Each relation is read exactly once. A hash node's budget is work_mem times 
hash_mem_multiplier, which defaults to two, so eight megabytes by default.
When the build side outgrows that, it splits into batches, one in 
memory and the rest written to disk. The probe side is split the same way, so every 
row lands in the batch that could hold its match. Nothing fails, and the only tell 
in the plan is the batch count. Raising the multiplier 
lifts hash operations alone. Hash join needs no ordering, only equality. The merge join has a prerequisite, and the docs lead with it: both relations 
are sorted on the join attributes first. Then the two are scanned in parallel, 
side by side in one process. Two pointers advance, always the smaller 
key, and equal keys produce a row. Nothing is built or stored, and 
each relation is scanned once. A run of equal keys on one 
side walks straight through. That sorting comes from an explicit sort step, 
or from an index scanned in the join key's order. The leaf level is already a linked list 
in key order, so the sort node is gone. Walking that leaf level still costs reads, and deduplication merges duplicate entries 
into one key plus a sorted pointer list. The stream is identical, from far fewer pages.
A nearly unique key gets almost none of it. Three algorithms, three prerequisites, 
and something has to choose. Three algorithms are on the table, 
and nothing has said which one runs. The planner prices all three and runs 
the cheapest before a single row moves. The docs say to check whether estimated 
row counts are close to reality, and that dead-on estimates are quite unusual.
The three algorithms rise on different curves, so a different row count makes 
a different one cheapest. Cost comes from cardinality, with the cost constants setting the slope and 
the row count picking the point. Cardinality comes from a sample, because ANALYZE 
reads a random slice rather than every row. The planner normally assumes 
conditions are independent, and correlated columns turn 
that into an underestimate. Those statistics shift a little on every 
ANALYZE, even when the table has not changed. Wrong estimates do not stay where they were made. Three tables and two joins, 
each node carrying an estimate. The bottom scan estimates two hundred rows 
and returns ten thousand, because country and currency are correlated 
and priced as independent. Rows removed by filter reads 
zero, and that is the tell. A parent cannot tell its child lied, so it 
works from a number fifty times too small. The join above adds its own factor of two, and 
factors multiply, so the top is out by a hundred. A nested loop over nine hundred and eighty rows 
into a primary key is the cheapest plan available. The same loop over ninety-eight thousand rows makes ninety-eight thousand scattered 
probes, where a hash join builds once. Every index here is already right, so read 
bottom up and fix the deepest blown ratio. Bigger join trees can go 
wrong differently each run. A big join tree can land differently each run, 
and the reason is how many join orders exist. Five tables give a hundred and twenty, and twelve 
give four hundred and seventy-nine million. Pricing all of them takes longer than 
the penalty of running a worse plan, so Postgres stops looking. So at twelve items in the FROM 
list, Postgres switches to GEQO, a genetic search that breeds join 
orders and keeps the best it found. Write those twelve as explicit JOINs instead, 
and Postgres keeps the order you typed. This search is randomized, and it still 
returns the same plan for the same query, because every run restarts 
from the same geqo_seed. When a big join's plan really does move, 
statistics shifted a little on the last ANALYZE. Which construct you wrote shapes the join 
too, and three of them are not equivalent. Which of this customer's forty-one 
thousand orders have at least one item? You can write it as a join, as IN, or as EXISTS. A join pairs rows, and it returns one 
output row for every pair it makes. Those orders average six items 
each, so the join hands back two hundred and forty-six thousand 
rows, each one repeated per item. Nothing in the text warns you, and summing revenue turns four point 
two million into twenty-six million. EXISTS returns only true or false, according to whether the subquery returned 
any rows, so extra matches cannot add rows. It generally runs only long 
enough to find one row. IN agrees with EXISTS here, and one 
of the three returns nothing at all. That one is NOT IN over a subquery, in a report asking which orders 
skipped the congested warehouses. It returns zero rows, with no error, 
nothing logged, and an ordinary runtime. The documentation says that with no 
match in the list and one null entry, the answer is null rather than true. WHERE keeps a row only when its condition is 
true, so null drops it exactly like false. A matching row comes back false, 
a missing one comes back null, and a null on the row does it too. Every row loses, whether seven 
entries are null or fourteen thousand. NOT EXISTS only asks whether a matching row exists, so it answers 
true or false and stops early. The planner builds an anti-join for NOT 
EXISTS and a per-row subplan for NOT IN. The trap is the subquery form, since a constant 
list only holds a null if you typed one. Default to NOT EXISTS, because 
this bug is wrong at full speed. That empty bar is habit three, memory, 
the last one the plan asks you to read. A sort that fits inside work_mem 
reports quicksort with a memory figure. Cut work_mem to a quarter, run the same query, and that line changes to external 
merge with a disk figure. External means the sort went outside its budget, and merge means it sorted in pieces 
and combined them afterwards. The line only shows on a plan that ran, and 
BUFFERS confirms it with temp blocks written. Nothing else in the plan moved, and the disk 
figure is not the size to raise work_mem to. Top-N heapsort, the method a small LIMIT gets, 
sorts more cheaply and still reads every row. Hash aggregates spill too, and work_mem 
is not counted the way people assume. work_mem reads like a budget, and it 
bounds neither a query nor a server. Each memory operator gets the whole value. One query can run several sorts and 
hashes at the same time, each allowed as much memory as the value specifies, 
and several sessions can be doing it too. Hash operators get double, so 
counting nodes undercounts. Three memory operations at two 
hundred and fifty-six megabytes is seven hundred and sixty-eight for 
one run, and three hundred sessions is two hundred and twenty-five gigabytes.
The machine has a hundred and twenty-eight. That is a worst case, since sessions rarely 
peak together, and nothing caps the total. So the default is four megabytes, 
and a raise belongs in one statement. Every problem in this module showed up in a plan. This is the one problem in the 
module that no plan will show you. A page lists five hundred orders and 
fetches each customer separately. The server saw five hundred and one queries. Every one of them is excellent, a primary-key 
lookup returning one row in under a millisecond. EXPLAIN explains a statement, and no statement 
here has all five hundred in its plan. You pay the round trip and 
the parse five hundred times. pg_stat_statements collapses queries 
that differ only in a literal into one row, so you see a huge call count, a tiny 
mean, and the biggest total in the table. log_min_duration_statement at zero logs 
every duration, which is how you count them. The fix is the join nobody wrote, and nothing 
yet has assumed anyone else was connected. Module four is done, let's test it.
A nested loop estimates fifteen rows and returns forty thousand.
What's the root cause, and does an index fix it? The answer is B, a bad row estimate. Two related columns were costed as 
independent, and multiplying gave fifteen. A is the trap because it works, cutting runtime 
by two thirds while forty thousand probes remain. C has no sort or hash here, and D 
is a cause of B, not a rival answer. The algorithm came from a row 
count, before you had a say. Two of these four are right. A query was fine at a hundred thousand rows, fell 
off a cliff at two million, and the plan changed. The answers are A and B. Nothing deletes statistics, 
though stale ones do move plans. The join flipped to a hash join, which 
is the planner being right at this size. The sort is the cliff, because 
thirty-one thousand rows fit in work_mem and six hundred 
and twenty thousand did not. The join node explains a slope, and 
the sort method explains the cliff. Last one, the trap from a few minutes ago. NOT IN against a subquery selecting a 
nullable column, so what comes back? The answer is B, zero rows.
A is what it looks like, until the first null. C is the expensive one, since nothing 
errors and an empty result looks correct. D is closest, because NOT EXISTS asks whether a row exists and never compares a value.
The trigger is a null in the result. It isn't the nullable column, so this 
runs correctly until the day it doesn't. Module five is transactions and isolation. One constraint this time, more than 
one person is using it at once. An isolation level decides one thing, 
when your transaction takes its snapshot. Postgres defaults to read committed, 
a fresh one every statement. Open a transaction, count this customer's orders, and that statement takes its snapshot as it 
begins, seeing everything committed up to then. Another session commits three more orders 
for that customer while you sit there. Your first answer stays put, because 
it was true when it was taken. Run the identical count again and it takes a 
second snapshot, and that one includes the commit. Nothing in your code changed, 
and the two answers differ. The standard calls that a nonrepeatable read. That is one of four behaviours the standard names, 
and the level above is where most people stop. That level is repeatable read, and it holds 
one snapshot for the whole transaction. Run the same count twice with a 
commit in between, and both match. The name comes from the SQL standard, and 
what runs underneath is snapshot isolation. The snapshot lands on your first 
real statement, not on BEGIN. The standard lists four ways concurrent 
transactions go wrong, and this level closes all but serialization anomalies.
Phantom reads, new rows appearing in a repeated range query, are allowed by the 
standard, and Postgres blocks them anyway. Three of the four close, which is why 
this one gets called the safe level. It even rolls you back rather than blocking 
when you change a row someone else changed. The fourth row stays open, and that is by design. The level above, serializable, closes 
it, and that open row has a name. The name is write skew, and the clearest 
picture of it is Kleppmann's hospital on-call. The rota has one rule, at 
least one doctor stays on call. Two doctors both feel ill on the same 
shift, and each opens a transaction at repeatable read to go off call.
Each checks the rota against its own frozen snapshot, sees the 
other still covering, and passes. Then each writes its own row and commits, 
and both commits come back clean. Nothing collides, because they changed different rows, so there's no second version to 
argue over and no lock to wait behind. The rota is empty, and the manual 
puts it plainly: at repeatable read, both transactions would be allowed to commit.
Every check passed and the rule broke. Read a set of rows, then write a row that changes 
the set, and something else has to catch it. What catches it is SSI, 
serializable snapshot isolation, which watches the relationships 
between transactions instead of rows. It remembers what each transaction read, 
and that record is a predicate lock. A read-write dependency is one transaction reading 
something another then writes, and on its own it's harmless, because a serial order still exists.
Those locks never block anything. The rota had one in each direction, and a transaction with one arriving and 
one leaving is a pivot, which no serial order survives, so Postgres cancels it.
The detector is deliberately careful. The loser gets an error: could not 
serialize access due to read/write dependencies among transactions.
Nothing waited anywhere, so there is no deadlock here, where two 
transactions each hold what the other needs. It sometimes cancels a transaction 
that would have been fine, and that moves the work into your application. Most people guess serializable costs latency, 
and nothing in that last scene waited. The real bill: applications using this level 
must be prepared to retry transactions. You retry the whole transaction from its first 
read, because every value it read is now suspect. The loop sits outside the transaction, 
in the code that opens it. You cannot guess which paths need it, 
since the manual calls predicting which transactions get rolled back very hard.
One shared layer catches error 40001 and runs the work again.
Skip the loop and a rare wrong answer becomes a visible failure, on 
work read committed would have finished. Repeatable read needs the same handler, since changing a row someone else 
changed rolls you back there too. Only writing transactions hit this, 
so read-only work never needs it. That's optimistic control, and sometimes 
you want to take the lock instead. Two workers grab the same job at once, 
because a plain SELECT hands the row to both. Postgres has four locking clauses, 
and the queue pattern uses FOR UPDATE. By default the clause waits for whoever holds the row, and your second worker stops 
with unclaimed jobs beneath it. NOWAIT turns that wait into an 
error the caller has to handle. SKIP LOCKED steps over any 
row it can't lock right away, so three workers leave with three different jobs. Order becomes a preference now.
The documentation names the use case itself, multiple consumers 
pulling from a queue-like table. The same sentence calls that view inconsistent 
and unsuitable for general purpose work, so a report returns a smaller, wrong answer. There is one kind of waiting that never ends. One session opens a transaction, writes a row, then goes off to call a payment provider and never 
comes back, holding no locks and blocking nobody. While it sits there the xmin horizon cannot move, and vacuum may not remove 
anything newer than that line. There is one line for the whole 
database, not one per table. A table that session never touched, belonging 
to another team, stops getting cleaned as well. Autovacuum keeps running and 
finishing, and removes nothing, so dead tuples pile up and 
every query reads more pages. That is the frozen vacuum pass 
from module one, finally explained. The documented check is pg_stat_activity, 
where either backend age column is large. Then commit, roll back, or terminate them.
idle_in_transaction_session_timeout ends these sessions, and it defaults to zero, 
which is why this keeps happening. An old replication slot pins it too, Postgres 
streaming its changes to a second machine. That second machine is a standby, 
or replica, replaying the primary's write-ahead log while it serves reads.
A long report is running on it. The primary removes row versions no 
transaction there needs, with no idea what the standby is reading.
When that record arrives the standby has no choice, because the action 
already happened, so it cancels the query. Replay waits first, for a bounded time, and a standby that waits is falling 
behind, which is what lag is. Turn on hot_standby_feedback and the 
primary stops removing rows the standby is still reading, so the cancellations stop.
The docs name what that costs, undesirable table bloat on the primary.
That is the third symptom. They are fair about it too: the cleanup situation is no worse than 
if that query had run on the primary. One forgotten BEGIN on the 
standby causes all three. Two transactions at repeatable read both read 
the same rota, both see a doctor still covering, and both file a leave request.
What happens? The answer is B, and both commit 
with no error and no waiting. This is write skew, and 
repeatable read permits it. A and D are the same behaviour named twice, 
both right at serializable rather than here. C is right for two transactions fighting over 
one row, and these never touched the same row. Snapshot isolation protects what you 
read, not the decision you made from it. Replica lag is 45 seconds and climbing, 
bloat is growing, and autovacuum runs but reclaims nothing.
What do you check first? The answer is B, pg_stat_activity, the 
only candidate that explains all three. C is the trap: autovacuum's cost 
settings change how fast a worker sweeps, while the oldest snapshot 
decides what it may remove. A explains the lag alone, 
and D explains none of them. Check what explains all three 
before you tune what explains one. Module six is read scaling. Two constraints, the data is bigger than 
memory and the power can fail mid-write. So what does one connection 
actually cost Postgres? Every client connection gets its 
own operating-system process, forked by a supervisor the moment you connect. Nobody at the database decides how many exist.
It is your app instances multiplied by each one's connection pool, the 
connections it keeps open and ready, so autoscaling to a hundred instances puts 
five thousand processes on the server. Almost all of them are idle, and an idle 
backend costs the same as a working one. There is no lighter option, because 
one backend per client is the design. Memory fills toward the machine's 
ceiling and response times climb while the count of statements 
actually running stays flat. Pooling is the first thing to fix here, 
and the mode you pick changes the rules. The pooler most teams reach for is PgBouncer, and 
its three modes make three different promises. Session pooling keeps a server connection 
for your whole session, transaction pooling only for a transaction, and statement 
pooling releases it after every statement. Transaction pooling is what lets forty 
backends serve thousands of clients, and your next statement can 
land on a different backend. Anything the server was holding for you is gone. PgBouncer's own table names seven 
things that never survive it: SET, LISTEN, held cursors, PREPARE, LOAD, 
session advisory locks and temp tables. Their own wording is that this 
breaks client expectations by design, and the one that bites silently is 
your driver's prepared statement. Your connections are under control now, 
and the machine underneath has not changed. Filling that space needs no new mechanism, 
because the WAL from module one is already a complete, correctly ordered description 
of every change this database has made. Hand that stream to another machine and 
it replays each record into its own pages, which is the same work crash recovery does. Streaming replication is asynchronous by 
default, so the replica's replay position trails the primary's write position, and the 
gap widens under a burst and closes again. Typically that stays under a second, 
assuming the standby keeps up with the load. When the primary dies, everything still in that 
gap was committed and never replicated, and the documentation calls that data loss, proportional 
to the replication delay at that moment. A replica replays a bad delete as faithfully 
as a good one, so a standby is not a backup. The word that makes those falling 
records serious is committed. The client asked, the server said yes, 
and the application acted on the yes. The transaction is durable on the primary, because its record reached that machine's 
disk, and it does not exist on the replica yet. How much you lose is not a number you can look up, it is however far behind the replica 
happened to be when the primary died. That is a distribution to measure, and 
the tail matters more than the median. Nothing raises an error, because 
the promoted standby comes up clean and consistent and never knew what it missed. There are two ways to narrow that window: fewer bytes in flight, or hold the 
commit until the standby has them. Closing that window takes one 
line, and naming a standby in the synchronous list changes every commit here. Each commit now waits until the 
record is on disk on both machines, and the round trip between them 
is the minimum, not the total. synchronous_commit sets how far a 
commit travels before it returns. remote_write waits for the standby's file 
system, on for a flush to durable storage, and remote_apply until a 
reader there would see it. Each one costs more, and the floor is physical, so machines in different regions put 
tens of milliseconds into every write. It is settable per transaction, so checkout 
pays for the round trip and analytics does not. Someone types a comment, hits post, 
and the page comes back without it. They assume it failed, post it 
again, and now there are two. Both requests succeeded and nothing is broken.
The write went to the primary because it writes, the read to a replica because it reads.
That replica has not caught up. This is the tightest read-after-write case 
there is, two requests one page render apart. Even a sub-second delay is far longer than that.
The row exists, just not there yet. Both reads are the same SQL, so the router 
cannot tell which one needs the primary. It never reproduces in staging, 
where nothing else writes. Swap the comment for a charge, and that 
guard read passes when it should fail. So how does the router know 
this session just wrote? All three fixes answer one question: can 
this replica serve this user's next read? The first routes a session's reads to the 
primary for a few seconds after a write, right while lag stays under your number 
and silently wrong once it does not. That is the condition during 
the incidents that cause lag, and it sends recent writers back to the primary. The second is sticky sessions, 
which buys monotonic reads, so a user's timeline never goes backwards. It does nothing here, because the write went 
to the primary and that replica is behind it. The third captures the LSN, a record's 
position in the write-ahead log, when the session writes, and reads only 
from a replica that has replayed past it. The first two stand in for replay, and 
the third compares against replay itself. One function reports the primary's write location, another the last one the standby replayed.
The difference in bytes is your replication lag. What does not exist is the verb.
Nothing in Postgres blocks until a replica has replayed past a 
position, and no setting turns it on. The wait is yours to write.
Ask the replica where it is, compare, sleep briefly, then ask again.
Every pass is a round trip, and they add up. Give it a deadline, because a lag spike 
turns stale reads into hung requests. When the deadline expires, 
fall back to the primary. Nothing warns you, and a replica that 
has caught up can still refuse the read. A long report runs on the standby 
while records keep arriving behind it. One record removes rows the report still 
needs, and the standby cannot refuse it, because that cleanup already 
happened on the primary. Replay stops, and while it is stopped nobody 
else on that machine sees recent changes. max_standby_streaming_delay bounds how 
long replay waits, with a matching setting for WAL read from an archive, and when 
the time is up the query is cancelled. The grace period is never more than the delay 
you set, and it shrinks once the standby has fallen behind, so a busy reporting 
replica cancels sooner and sooner. A cancelled query can be retried 
and often succeeds the second time. Only two of the five conflict types involve vacuum, so hot_standby_feedback does 
nothing for the lock and drop cases, and a delay of minus one waits forever, 
trading cancellations for unbounded lag. You already have two caches under every query.
The buffer pool gets a quarter of memory to start and forty percent as a ceiling, because Postgres 
leans on the operating system's cache too. Putting Redis in front adds a third layer 
with the same mechanism: bounded memory, and a rule for what leaves when it fills. What changes is who owns that rule, because down there you get no vote 
and up here the policy is yours. A slot up here holds whatever you called a key, 
and nothing tells it when a write made that stale. Invalidation is the whole job, 
caching has its own video here, and none of these layers 
changed the table underneath. Those dividers are partitions, one 
table cut into pieces on one column, still one database with one planner.
Pruning depends entirely on which column that is. Partition pruning is the planner 
reading each partition's boundary and proving it cannot hold a 
row matching your WHERE clause. Nothing is sampled or estimated, so this is 
the one place the planner is not guessing. Five years of orders at monthly 
boundaries is sixty partitions, and a thirty-day range overlaps two, 
so fifty-eight are excluded unread. It happens during execution too, so a bound 
that arrives as a parameter still prunes after the plan is built, and a partition 
pruned while planning leaves no trace. A query on the tenant key alone excludes 
nothing, and gets sixty tables in its plan. The bigger win is on the way out. There are two ways to get old 
data out, and only one is cheap. Deleting six million old rows removes 
nothing, since it stamps six million row versions, writes a log record for 
each, and hands the pile to autovacuum. The space goes back to the free list rather 
than the filesystem, so the file never shrinks. Dropping a partition is far faster 
and avoids all of that vacuum work, because its rows live in their own 
files and dropping it unlinks them. Detaching is just as cheap and keeps the data, since the partition becomes a 
table of its own to archive later. Decide how data leaves your table while 
you are still designing the schema. That decision comes with one rule: a 
unique or primary key on a partitioned table must include every partition key column. Each partition carries its own index, and that index can only enforce 
uniqueness inside its own partition. Nothing checks across them, so the same 
id could sit in two different months. A primary key on id alone is rejected 
on a table partitioned by created_at. The accepted form is id plus created_at, 
which changes what the key means. The other half is that the partition 
key cannot be an expression, so a function of created_at 
rules out unique constraints. Child tables must reference the 
pair, so they carry created_at too. Partitioning was one engine holding many pieces, and a shard is a whole database 
holding one piece on its own machine. The router decides which shard owns which key, 
and that buys write throughput, since different shards sit on different machines.
The trap is the shard key, because sequential values all land on 
one shard while the others sit idle. Hash the key instead and consecutive 
values scatter, the same physics as the hot partition problem in the DynamoDB video.
Every shard then carries a share of the writes. The cost is everything that crosses a 
shard, so a join becomes a scatter and a merge, a transaction across two becomes 
distributed, and rebalancing moves data. Past that line, none of this 
is a Postgres problem any more. Users say their own comments 
vanish right after posting. Reads go to replicas, average 
lag two hundred milliseconds. Faster hardware, more replicas, tracking the 
write position per session, or a longer cache TTL? The answer is tracking the write position.
Faster hardware makes the window smaller, and smaller is not zero, so the same 
user hits the same bug less often. More replicas makes it worse, because the 
balancer can pick one that is further behind. Only routing past your own 
write makes it impossible. One more. An eight hundred gigabyte table, queried only by 
tenant and time range, and the monthly cleanup delete takes hours.
Partition, or shard? Partition, by time. The delete is slow because deleting 
rows does not reclaim the space, so dead versions pile up for vacuum.
Dropping a partition skips all of that. Sharding would add machines to a 
table that already fits on one. The price is that unique constraints 
have to include the partition key. Schema design, and it answers 
the first two constraints: bigger than memory, and more 
than one person at once. So where does a schema actually come from?
The usual answer draws the nouns, joins them with keys, normalises, 
and writes the queries afterwards. Turn it around and write the questions first. Five here: a customer's recent orders at 
fifty thousand a second, one order by id, a yearly count, status changes this 
hour, and a warehouse's active work. Those five give you the 
columns, and the indexes too. Recent orders wants a composite 
index on customer and time. The count needs nothing new, because equality on the customer narrows 
to one slice that counting walks in order. One order by id is already served by the 
primary key, composite because the table is cut into a partition per time range.
The entity diagram was never the input. This is the order DynamoDB forces on 
you, and sometimes it duplicates data. That arrow wanted the order's total.
Read the plan first, and read the actual figures. The aggregate is a subplan running once per 
row returned, twenty loops for twenty orders. As a join it becomes a hash join, 
one build pass, one probe pass, and work_mem times the hash 
multiplier before it spills. Both are correct, and both are 
expensive at five thousand a second. Store the total on the row and the 
read becomes one column access. It is a second copy, so the schema comment 
names its owner and the job that checks it. Afterwards there is no subplan and no join, one descent and twenty fetches.
The duplication was deliberate. Those constraints hide a decision of their own. The mistake here is a unique 
index on the idempotency key. Nulls are not equal by 
default, so every one gets in. So the constraint is off for 
exactly the rows that have no key. Add NULLS NOT DISTINCT to the 
index and the second one bounces. That clause tells the index to 
treat two nulls as the same value. It arrived in Postgres 15, and the workarounds 
people used before it all leaked somewhere. A unique index on two columns only rejects a row when all of them are equal, 
which catches people too. This one you can choose, and the 
next five get made by accident. The first is the primary key, 
and you have seen it already. Random keys hit a different 
leaf page on every insert. Pages settle at sixty five to seventy percent 
full, where climbing keys pack to ninety. Same rows, one schema line, and 
that index stays bigger for life. The standard says identifiers that are 
not time ordered have poor index locality. UUIDv7 puts a millisecond timestamp up front, 
so values made in succession land together. On Postgres 18 the fix is one built-in function. On an existing table it is a whole 
migration with a batched backfill. Your other indexes sort by their own 
columns, so the damage stays here. Mistake two is a side table holding 
an attribute name and a value. That is EAV, entity attribute value, and 
new attributes never need a schema change. Prices, dates, country codes and 
free text all sit in there as text. The planner keeps statistics per column, so that histogram describes everything 
at once and nothing in particular. Ask for one price, the estimate says 
one row, the truth is over a million. A number that wrong multiplies 
all the way up the join tree. Extended statistics will not help, because 
there is no correlation to capture. One column carries five meanings, 
and each deserves its own column. Generic columns starve the planner, 
and so does the modern version. The modern version is a jsonb column holding 
twelve keys, which is EAV with nicer syntax. It is right for shapes you cannot predict. This is about the fields you query.
pg_stats counts distinct blobs, never the country codes inside them.
Any predicate reaching inside gets a hardcoded fraction, so every plan is a guess. The usual fix is a GIN index, the 
inverted kind for multi-component values. Every insert updates one posting list per key, so twelve keys at two thousand writes a 
second means twenty four thousand touches. The honest middle is an expression index on 
the field you query, or a typed column instead. Nobody budgeted that write cost, 
and the next mistake is invisible. The invisible one is a deleted-at column.
Stamping instead of deleting keeps the audit trail and the restore option.
The index does not know that. Every query then grows a check for the stamp.
The scan still walks every entry, including the dead fifth, and discards them.
Those rows also get maintained on every change. Bake that condition into the index 
and the stamped rows fall out. That is a partial index, and the 
docs give two wins: a smaller index, and fewer updates, since it 
is not maintained every time. The rows are still there, so the 
audit lookup works another way. A query without that condition 
cannot use the index. The next is there from the first wide row. Mistake five was designed in from day one. A row over two kilobytes moves its big fields 
into the TOAST table, and a pointer stays behind. This is not a blob problem.
Two kilobytes is nowhere near a full page, and ten text columns at two hundred 
and fifty bytes each are already over. Reading that field back costs a second fetch. On average it is still a win, since 
more rows fit in the buffer pool. SELECT asks for the wide column 
whether you needed it or not. Two ways out. Move it into its own table and join when you 
need it, or hold the line on column lists. The schema is right now, and 
it is already in production. Changing a live schema is 
the other half of the job. Almost every ALTER TABLE takes Postgres's 
strongest lock, ACCESS EXCLUSIVE. That blocks every other session 
on the table, reads included. Two statements with near-identical 
syntax can have opposite outcomes. The lock lasts as long as the statement runs. Add a column with a constant default and Postgres 
keeps the value in metadata, touching no rows. A volatile default rewrites the whole table 
and every index, and so do generated columns, identity columns and constrained domains.
Eight hundred gigabytes and eleven indexes, locked throughout, runs for hours. The trap is a timestamp defaulted to the 
clock, which looks constant and is not. Add it with a fixed literal, change 
the default afterwards, then backfill. That way nothing gets rewritten. Postgres 11 made that default 
fast, and only for a real constant. The rest need a different shape entirely. When the shape of the data changes, 
no single statement is safe. The pattern is expand and contract: add 
the new shape, run both, drop the old. Deploy one adds the column, metadata only.
Deploy two turns on dual writes, every insert and update writing both shapes in 
one transaction, so they agree from then on. Deploy three backfills the history in 
batches, throttled and checkpointed, because one big update would 
lock the table and rewrite it. Every batch leaves dead tuples, 
so watch vacuum keep up. Deploy four flips reads to the new column, the reversible moment, because 
the old data is untouched. Then the dual writes come off.
Four deploys, and no downtime. Drop the old column last, 
since that cannot be undone. None of it works if something 
waits on a lock forever. A migration waiting on an ACCESS 
EXCLUSIVE lock does not wait quietly. It joins the lock queue, and everything 
arriving after it queues behind, reads included. Five minutes of waiting is five 
minutes of serving nothing. The queue is dozens deep by then, 
and every one of them is a user. lock_timeout aborts a statement 
that has waited too long for a lock, and zero, the default, means forever. Set five seconds and it gives 
up before a queue forms. It only counts time spent 
waiting, unlike statement_timeout. The limit applies to each lock, so 
three locks can wait three times. Keep it in the transaction, 
never in the config file. All seven layers are walked, 
and now one of them breaks. You are picking a primary key for a table 
taking two thousand writes a second. Which one, and why? B and C both work by inserting at the right edge.
One generates anywhere, the other stays smaller. A is the trap, and its reasoning is the trap.
Random keys do distribute load, and load spread across an index means splits.
D is right for some other table. Random is what you want from a 
shard key and not from an index key. The answer here is a ranking.
Random key, soft deletes, a jsonb blob, nullable status.
What breaks first at a hundred million rows? A goes first, from day one.
Random keys scatter every insert, so the primary key carries a permanent premium. There is no threshold to cross here, 
because the cost starts with the first row. C is second: predicates inside the blob get 
default estimates, harmless when small and a nested loop at scale.
B is third, since every index carries the soft-deleted rows.
D never becomes a database problem. Scale failures arrive in an order, 
and that order says what to fix first. Everything you are about to 
see has already been on screen. Same table, same query, and the same seven 
notes it picked up on the way through. Two hundred million rows, eight hundred gigabytes, 
fifty thousand reads a second, eleven indexes. The p99 was eighty milliseconds, 
now three and a half seconds. The replica is forty-five 
seconds behind and still falling. Autovacuum last finished nine days ago. They have already tried four 
things, and you know all four. They added an index, doubled the instance, 
added a replica, and put Redis in front of it. Every one of them made sense at the time.
None of it worked. One reporting query has a nested 
loop in it, estimating fifteen rows and getting forty thousand.
The tenant query filters on customer plus a time range, and their 
index covers the customer alone. You get one week.
What do you do first, and why does the obvious answer make it worse? The index they have is on the customer alone. The descent finds that customer, then 
every order they have ever placed. Module 2's rule was equality 
columns first, range column last, and this index has no range column.
So it cannot narrow on time. Add created_at as the second column and 
the descent narrows to the customer, walks the leaves in date 
order, and stops after twenty. The bad plan reads all 
forty-one thousand rows first. Same query, twenty fetches 
instead of forty-one thousand. That index does not exist yet. A plain CREATE INDEX on eight 
hundred gigabytes locks the table against writes until it finishes.
Every insert queues behind it. CONCURRENTLY makes two passes instead 
of one, so the build takes longer. Writes keep landing the whole 
time, and that is the trade. If it fails partway it leaves 
an invalid index behind, costing you writes and serving no reads.
You have to drop that yourself. It is in, and nothing is fixed. That makes twelve.
Every write touching an indexed column updates all of them, and eleven was already the bill.
The twelfth costs the same as the others. Nothing has cleaned up behind 
those writes for nine days. Old row versions are piling up under the table. The cleanup job has four jobs 
and has finished none of them. The new index walks past all of that to 
reach rows that are actually visible. It helped, and it helped less than it should have. Doubling the instance made 
all those wasted reads faster. It bought four hundred milliseconds 
and changed nothing about the work. Autovacuum last completed nine days 
ago, and something is stopping it. Those are three symptoms: bloat on 
the primary, autovacuum stalled, and the replica falling behind.
They look like three problems, sitting in three different places. There is one long reporting query, 
and it is running on the standby. While it runs, WAL replay there stops.
The standby cannot apply anything new. That stall is the forty-five seconds of lag.
With hot_standby_feedback on, the query sends its xmin back to the primary, which holds 
back cleanup and gives you the bloat. Vacuum cannot remove rows 
that query can still see. That is one cause producing all three. Checking activity on the standby shows it: 
one long query, xmin pinned, replay stuck. They never looked on the 
standby, where all of it started. The fourth fix was Redis, and 
it came back at four percent. That number was the diagnosis, 
and nobody read it as one. Two things make a useful hit rate impossible here.
The table is multi-tenant with a long tail of customers, so most keys are 
never asked twice before eviction. The query also filters on the last thirty 
days, and that window moves on every run, so the same customer gets a 
different key ten minutes later. Most requests ask for something never seen before, 
on a query whose key would have changed anyway. Before you cache, check 
whether the workload repeats. One symptom left, and it is the plan. The last symptom is the reporting 
query, a nested loop estimating fifteen rows and getting forty thousand.
That gap is where the plan goes wrong. Country is US and currency is USD, and the 
planner multiplies those as if independent. They are not, and the estimate collapses. Underneath that, statistics are 
a sample and the sample drifts. ANALYZE has not run in nine days, because 
autovacuum does it and has not finished. Two fixes: ANALYZE for the drift, 
CREATE STATISTICS for the correlation. Neither alone is enough. Every symptom is explained now, 
and none of it is structural. Every symptom is explained, and the table is 
still eight hundred gigabytes on one machine. Nothing structural has changed, 
and that part is still ahead. Partition it by time.
The planner proves which monthly partitions a query 
cannot match and skips them, and it does that while the query is running.
The rest are never touched. Dropping last month stops being an outage. Detaching a partition is far faster than deleting 
the rows, and it avoids the cleanup cost entirely. The cost is real: the primary 
key becomes id plus created_at, every foreign key has to carry created_at 
too, and the application changes shape. Sharding is the wrong answer. Two thousand writes a second on one 
machine does not need more machines. It needed no new tool, only knowing 
what the engine already does. Three things and then I'll let you go.
First, what this video did not cover: CAP and consistency models, consensus, failover, distributed transactions, deep 
write tuning, engine comparisons. Each is its own video, and none of 
them stick until this part is solid. Second, the one thing to take away.
When a database gets slow, the useful question is which of the three constraints you just hit.
The data is bigger than memory, more than one person is using it at once, or 
the power can fail mid-write. Everything in this video was one of those three, wearing different clothes.
Every layer exists to soften one. Subscribe if this was useful, like it, 
and share it with someone who needs it.