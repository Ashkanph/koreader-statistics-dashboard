import sqlite3, random, time, os, sys, math
if len(sys.argv) != 2:
    sys.exit(f"usage: {sys.argv[0]} OUTPUT.sqlite3")
out = sys.argv[1]
if os.path.exists(out): os.remove(out)
c = sqlite3.connect(out)
c.execute("PRAGMA journal_mode=WAL;")
c.executescript("""
CREATE TABLE book (id integer PRIMARY KEY autoincrement, title text, authors text, notes integer, last_open integer, highlights integer, pages integer, series text, language text, md5 text, total_read_time integer, total_read_pages integer);
CREATE UNIQUE INDEX book_title_authors_md5 ON book(title, authors, md5);
CREATE TABLE IF NOT EXISTS page_stat_data (id_book integer, page integer NOT NULL DEFAULT 0, start_time integer NOT NULL DEFAULT 0, duration integer NOT NULL DEFAULT 0, total_pages integer NOT NULL DEFAULT 0, UNIQUE (id_book, page, start_time), FOREIGN KEY(id_book) REFERENCES book(id));
CREATE INDEX IF NOT EXISTS page_stat_data_start_time ON page_stat_data(start_time);
CREATE TABLE IF NOT EXISTS numbers (number INTEGER PRIMARY KEY);
WITH RECURSIVE counter AS (SELECT 1 as N UNION ALL SELECT N + 1 FROM counter WHERE N < 1000) INSERT INTO numbers SELECT N AS number FROM counter;
CREATE VIEW IF NOT EXISTS page_stat AS
    SELECT id_book, first_page + idx - 1 AS page, start_time, duration / (last_page - first_page + 1) AS duration
    FROM (
        SELECT id_book, page, total_pages, pages, start_time, duration,
            ((page - 1) * pages) / total_pages + 1 AS first_page,
            max(((page - 1) * pages) / total_pages + 1, (page * pages) / total_pages) AS last_page,
            idx
        FROM page_stat_data
        JOIN book ON book.id = id_book
        JOIN (SELECT number as idx FROM numbers) AS N ON idx <= (last_page - first_page + 1)
    );
PRAGMA user_version=20221111;
""")
random.seed(4)
books = [
 ("Hyperion","Dan Simmons","Hyperion Cantos #1","en",482),
 ("Cat’s Cradle","Kurt Vonnegut Jr.","N/A","en",306),
 ("Small gods","Terry Pratchett","Discworld #13","en",389),
 ("A Short Stay in Hell","Steven L. Peck","N/A","en",108),
 ("The library at mount Char","Scott Hawkins",None,"en",390),
 ("The Zero Stone","Andre Norton","Murdoc Jern #1","en",221),
 ("Red Rising","Pierce Brown","Red Rising Saga #1","en",382),
 ("Die Wand","Marlen Haushofer","N/A","de",285),
 ("The man who bridged the mist","Kij Johnson",None,"en",46),
 ("City of Illusions","Ursula K. Le Guin","The Hainish Cycle #3","en",160),
 ("Way station","Clifford D. Simak","N/A","en",210),
 ("Gateway","Frederik Pohl","Heechee Saga #1","en",278),
 ("Waiting for the Barbarians","J.M. Coetzee","N/A","en",152),
 ("Il deserto dei Tartari","Dino Buzzati","N/A","it",234),
 ("The Remains of the Day","Kazuo Ishiguro","N/A","en",258),
 ("Flowers for Algernon","Daniel Keyes","N/A","en",311),
]
now = int(time.time())
# At least FINISHED_SHARE of the books end above 95% progress, which the app counts as fully read.
FINISHED_SHARE = 0.6
finished = set(random.sample(range(len(books)), math.ceil(len(books)*FINISHED_SHARE)))
for i,(t,a,s,l,p) in enumerate(books):
    c.execute("INSERT INTO book VALUES(NULL,?,?,?,?,?,?,?,?,?,0,0)",(t,a,random.randint(0,5),now,random.randint(0,30),p,s,l,"%032x"%random.getrandbits(128)))
    bid=c.execute("select last_insert_rowid()").fetchone()[0]
    start = now - random.randint(20,500)*86400
    ts=start; page=1
    if i in finished:
        # Most are read to the last page; some stop just short of it (96-99%).
        target = p if random.random() < 0.6 else math.ceil(p*random.uniform(0.96,0.99))
    else:
        target = int(p*random.uniform(0.2,0.8))
    while page<=target:
        # a session
        hour = random.choice([7,8,12,21,22,23])
        day = time.localtime(ts)
        ts = int(time.mktime((day.tm_year,day.tm_mon,day.tm_mday,hour,random.randint(0,59),0,0,0,-1)))
        for _ in range(random.randint(5,40)):
            if page>target: break
            d=random.randint(20,110)
            c.execute("INSERT OR IGNORE INTO page_stat_data VALUES(?,?,?,?,?)",(bid,page,ts,d,p))
            ts+=d; page+=1
        ts += random.choice([1,1,1,2,3,7])*86400
c.execute("UPDATE book SET last_open=(SELECT max(start_time) FROM page_stat_data WHERE id_book=book.id)")
c.execute("INSERT INTO book VALUES(NULL,'Never opened','X',0,0,0,100,NULL,NULL,'abc',0,0)")
c.commit()
c.execute("PRAGMA wal_checkpoint(TRUNCATE)")
c.close()
