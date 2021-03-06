import {Publication, PublicationDay} from "./parser";
import {parse} from "node-html-parser";
import {downloadObject, uploadObject} from "./utils";
import * as request from "request-promise";

export type TitulkaResult = {
    img: string;
    link: string;
}


export const getTitulka = async (publication: Publication): Promise<Map<string, TitulkaResult>> => {
    const html = await downloadPage(publication);
    return findTitulka(html!);
};

const findTitulka = (html: string): Map<string, TitulkaResult> => {
    const root = parse(html);
    const issues = (root as any).querySelectorAll('.issue');
    const outMap: Map<string, TitulkaResult> = new Map();
    issues.forEach((issue: any) => {
        const issueDate = issue.querySelector('.name').rawText;
        const match = issueDate.match(/([0-9]+)[-_\\. ]+([0-9]+)[-_\\. ]+([0-9]+)/);
        if(!match) {
            console.log("Unmatchable", issueDate);
            return;
        }
        const [_, dayOrYear1, month, dayOrYear2] = match;
        if(!dayOrYear2) {
            console.log(issueDate);
        }
        const [day, year] = dayOrYear2.length === 4
            ? [dayOrYear1, dayOrYear2]
            : [dayOrYear2, dayOrYear1];
        const dayId = year + month + day;
        const img = issue.querySelector('img').attributes.src;
        const link = "https://www.alza.cz/" + issue.querySelector('a').attributes.href;
        const titulka: TitulkaResult = ({img, link});
        outMap.set(dayId, titulka);
    });
    return outMap;
};

const downloadPage = async (publication: Publication): Promise<string | null> => {
    const url = getAddressForPublication(publication)!;
    return await request({url, gzip: true})
    // return fs.readFileSync(__dirname + "/../data/" + publication + ".htm", 'utf-8');
};

const getAddressForPublication = (publication: Publication): string | null => {
    switch (publication) {
        case "idnes":
            return "https://www.alza.cz/media/mf-dnes-d2172048.htm";
        case "lidovky":
            return "https://www.alza.cz/media/lidove-noviny-d2172049.htm";
        case "novinky":
            return "https://www.alza.cz/media/pravo-d2172145.htm";
        case "ihned":
            return "https://www.alza.cz/media/hospodarske-noviny-d2172555.htm";
        case "denik":
            return "https://www.alza.cz/media/prazsky-denik-d4721295.htm";
        case "blesk":
            return "https://www.alza.cz/media/blesk-d5628082.htm";
        case "e15":
            return "https://www.alza.cz/media/e15-d5631492.htm";
        default:
            return null;
    }
};


const download = async function (filename: string): Promise<PublicationDay> {
    try {
        return JSON.parse((await downloadObject(filename)).toString()) as PublicationDay;
    } catch (e) {
        return {
            articles: [],
            hours: []
        }
    }
};
(async () => {
    const maps: Map<string, Map<string, TitulkaResult>> = new Map();
    const printPublications: Publication[] = ['e15'];
    await Promise.all(printPublications.map(async (publication) => {
        const map = await getTitulka(publication);
        maps.set(publication, map);
    }));
    const minDay = 20170531;
    const days = Array.from(maps.get(printPublications[0])!.keys())
        .filter(d => parseInt(d, 10) >= minDay);
    console.log(maps);
    console.log(days);
    days.forEach(async (day) => {
        console.log(day);
        try {
            printPublications.forEach(async(publication) => {
                const filename = `daypub-${day}-${publication}.json`;
                const json = await download(filename);
                json.print = maps.get(publication)!.get(day);
                await uploadObject(filename, json);
            });
        } catch (e) {
            console.error('Fuck', day, e);
        }
    });

})();
