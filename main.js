const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// search keyword and return yes24 search result from 국내도서
const searchBook = async (keyword) => {
    keyword = encodeURI(keyword);
    try {
        return await axios.get(
            `http://www.yes24.com/Product/Search?domain=BOOK&query=` + keyword
        );
    } catch (err) {
        return false;
    }
};

// search keyword and return yes24 search result from 통합검색
const searchWide = async (keyword) => {
    keyword = encodeURI(keyword);
    try {
        return await axios.get(
            `http://www.yes24.com/Product/Search?domain=ALL&query=` + keyword
        );
    } catch (err) {
        return false;
    }
};

// goto book info
const goBookInfoLink = async (keyword) => {
    keyword = encodeURI(keyword);
    try {
        return await axios.get(`http://www.yes24.com` + keyword);
    } catch (err) {
        return false;
    }
};

// get book url
// if not searched in 국내도서, research at 통합검색 and return url
const getBookUrl = async (keyword) => {
    let html = await searchBook(keyword);
    let $ = cheerio.load(html.data);

    let bookUrl = $(
        '#yesSchList > li:nth-child(1) > div > div.item_info > div.info_row.info_name > a.gd_name'
    ).attr('href');

    if (bookUrl) {
        return bookUrl;
    } else {
        html = await searchWide(keyword);
        $ = cheerio.load(html.data);

        bookUrl = $(
            '#yesSchList > li:nth-child(1) > div > div.item_info > div.info_row.info_name > a.gd_name'
        ).attr('href');

        return bookUrl;
    }
};

// get book's info and return frontmatter
// if book has sub title, title will be merged
// if page is not number, convert into 0
const getBook = async (keyword, rate) => {
    const bookUrl = await getBookUrl(keyword);

    if (!bookUrl) {
        return [false, false];
    }

    const bookContent = await goBookInfoLink(bookUrl);

    const $ = cheerio.load(bookContent.data);

    const tags = {};

    $(
        '#infoset_goodsCate > div.infoSetCont_wrap > dl:nth-child(1) > dd > ul > li > a'
    ).each((_, elem) => {
        tags[$(elem).text().replace(/(\s*)/g, '')] = true;
    });

    const tag = Object.keys(tags);

    let title = $('#yDetailTopWrap > div.topColRgt > div.gd_infoTop > div > h2')
        .text()
        .replace(/\(.*\)/gi, '')
        .replace(/\[.*\]/gi, '')
        .replace(':', '：')
        .replace('?', '？')
        .trim();

    const subTitle = $(
        '#yDetailTopWrap > div.topColRgt > div.gd_infoTop > div > h3'
    )
        .text()
        .replace(':', '：')
        .replace('?', '？')
        .trim();

    if (subTitle) {
        title = title + '：' + subTitle;
    }

    const author = [];
    $(
        '#yDetailTopWrap > div.topColRgt > div.gd_infoTop > span.gd_pubArea > span.gd_auth'
    )
        .children()
        .each((_, elem) => {
            if ($(elem).text()[0] !== '\n') {
                author.push($(elem).text());
            }
        });

    let page = +$(
        '#infoset_specific > div.infoSetCont_wrap > div > table > tbody > tr:nth-child(2) > td'
    )
        .text()
        .split(' ')[0]
        .slice(0, -1);

    if (isNaN(page)) page = 0;

    const publishDate = $(
        '#yDetailTopWrap > div.topColRgt > div.gd_infoTop > span.gd_pubArea > span.gd_date'
    )
        .text()
        .split(' ')
        .map((v) => v.slice(0, -1))
        .join('-');

    const coverUrl = $(
        '#yDetailTopWrap > div.topColLft > div > span > em > img'
    ).attr('src');

    const result = `---
created: ${
        new Date(+new Date() + 3240 * 10000).toISOString().split('T')[0] +
        ' ' +
        new Date().toTimeString().split(' ')[0].slice(0, 5)
    }
tag: 📚독서 ${tag.join(' ')}
title: ${title}
author: ${author.join(', ')}
category: ${tag[1]}
total_page: ${page}
publish_date: ${publishDate}
cover_url: ${coverUrl}
status: 🟩 완료
start_read_date: ${
        new Date(+new Date() + 3240 * 10000).toISOString().split('T')[0]
    }
finish_read_date: ${
        new Date(+new Date() + 3240 * 10000).toISOString().split('T')[0]
    }
my_rate: ${rate}
book_note: ❌
---

# ${title}`;

    return [
        title
            .replace('：', ' ')
            .replace('？', '')
            .replace('/', '／')
            .replace(/\s{2,}/gi, ' '),
        result,
    ];
};

// get book info and save into md file
const saveAsMd = async (keyword, rate) => {
    const [title, result] = await getBook(keyword, rate);

    if (!title) {
        console.log(`${keyword} No title found`);
        return false;
    }

    fs.writeFileSync(`./sample/${title}.md`, result, {
        encoding: 'utf8',
    });

    console.log(`${title} Complete`);
    return title;
};

// for 1.txt to 5.txt, book crawling
const excute = async () => {
    const notFound = [];
    const notMatch = [];
    const titles = [];

    if (!fs.existsSync('./sample')) fs.mkdirSync('./sample');

    for (let i = 1; i <= 5; i++) {
        let article;
        try {
            article = fs.readFileSync(`${i}.txt`);
        } catch (e) {
            console.log(`${i}.txt Not Found`);
            continue;
        }
        const line = article.toString().split('\n');
        notFound.push(i);
        notMatch.push(i);
        titles.push(i);

        for (let j = 0; j < line.length; j++) {
            try {
                const title = await saveAsMd(line[j], i);
                if (!title) {
                    notFound.push(line[j]);
                    continue;
                }
                if (title !== line[j]) {
                    notMatch.push(line[j] + ' | ' + title);
                }
                titles.push(title);
            } catch (e) {
                notFound.push(line[j]);
                continue;
            }
        }
    }

    fs.writeFileSync(`Not Found.txt`, notFound.join('\n'), {
        encoding: 'utf8',
    });

    fs.writeFileSync(`Not Matchs.txt`, notMatch.join('\n'), {
        encoding: 'utf8',
    });

    fs.writeFileSync(`Titles.txt`, titles.join('\n'), {
        encoding: 'utf8',
    });
};

excute();
