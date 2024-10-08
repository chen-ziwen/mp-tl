import chalk from "chalk";
import * as languages from "@bin/langs";
import {
    LANGUAGE_MAP,
    DEFAULT_LANGUAGE,
    TLMRC,
    LANGUAGE_ZH
} from "@/constants";
import {
    readFile,
    writeFile,
    errorLog,
    successLog,
    getPlatformInfo,
    stringFill,
    foundZhMap,
    getPlatformName,
    isLowerCaseEqual,
} from "@util/helpers";

interface LangsList {
    name: string;
    code: string;
    selectable: boolean;
}

async function isTranslationPlatformNotFound(name: string, print = true) {
    const { platform } = await getPlatformInfo();
    const keys = platform.map(item => item[0]);
    if (!keys.includes(name)) {
        print && errorLog(`不支持 \`${name}\` 翻译平台，请使用 \`tlm ls\` 命令查看可支持平台`);
        return true;
    }
    return false;
}

async function languageListHandle() {
    const config = <Tl.Config>await readFile(TLMRC);
    const { source, pl } = config;
    const { sourceMap, targetMap } = (<{ [key: string]: Tl.LangsConfig }>languages)[pl];
    const condition: { [key: string]: boolean } = { "include": false, "exclude": true };
    const langsList: { [key: string]: LangsList[] } = { source: [], target: [] };
    const langsMap: { [key: string]: Tl.LangMsg } = { "source": sourceMap, "target": targetMap[source] };

    for (let value of LANGUAGE_MAP) {
        const code = value.code;
        const name = value.zh + "-" + code;
        for (let key in langsMap) {
            const { strategy, language } = langsMap[key];
            if (language.includes(code) == condition[strategy]) {
                langsList[key].push({ name, code, selectable: false });
            } else {
                langsList[key].push({ name, code, selectable: true });
            }
        }
    }
    return langsList;
}

async function showPlatformList() {
    const { pl, platform } = await getPlatformInfo();
    platform.forEach(([key, value], idx) => {
        const prefix = isLowerCaseEqual(key, pl) ? chalk.blue.bold("* ") : "  ";
        const suffix = isLowerCaseEqual(key, pl) ? chalk.blue(" (目前使用)") : "";
        let message = prefix + value.name + suffix;
        if (idx == 0) message = "\n" + message;
        console.log(message);
    });
}

async function showLanguageList(len = 14) {
    const langsList = await languageListHandle();
    const { source, target } = <Tl.Config>await readFile(TLMRC);
    const map: { [key: string]: string } = { source, target };

    console.log(`\n- ${chalk.blue('蓝色')}高亮文本为当前选中语种\n- ${chalk.red('红色')}高亮文本为当前不支持语种\n- 不同翻译平台的不同语种支持略有差异\n`);
    console.log(`| ${stringFill(len, '源语言')} | ${stringFill(len, "目标语言")} |`);
    console.log(`|${'-'.repeat(len + 2)}|${'-'.repeat(len + 2)}|`);
    LANGUAGE_MAP.forEach(item => {
        let rowStr = "";
        Object.entries(langsList).forEach(([key, list]) => {
            let row = list.find(row => row.code == item.code);
            if (row) {
                let name = row.name;
                if (!row.selectable) name = chalk.red(name);
                if (item.code == map[key]) name = chalk.blue(name);
                if (key == "source") {
                    rowStr += `| ${stringFill(len, name)} |`;
                } else {
                    rowStr += ` ${stringFill(len, name)} |`;
                }
            }
        });
        console.log(rowStr);
    })
}

async function changePlatform(name: string) {
    if (await isTranslationPlatformNotFound(name)) return;
    const config = <Tl.Config>await readFile(TLMRC);
    const { source, target } = config;
    config.pl = name;
    await writeFile(TLMRC, config);
    const plName = await getPlatformName(name);
    successLog(`正在使用${plName}翻译平台`);
    await changeLanguageCode({ source, target }, { printSuc: false });
}

async function changeLanguageCode(langs: Tl.DefaultLangs, { printSuc = true, printErr = true }) {
    const config = <Tl.Config>await readFile(TLMRC);
    const { source, target, pl } = config;
    const map = Object.assign({ source, target }, langs);
    const { codeMap, sourceMap, targetMap } = (<{ [key: string]: Tl.LangsConfig }>languages)[pl];
    const condition = { "include": false, "exclude": true };

    let key: keyof typeof map;
    for (key in map) {
        const value = map[key];
        if (Object.keys(codeMap).includes(value)) {
            const langsMap: { [key: string]: Tl.LangMsg } = { "source": sourceMap, "target": targetMap[map["source"]] };
            const { strategy, language } = langsMap[key];
            if (language.includes(value) == condition[strategy]) {
                map[key] = DEFAULT_LANGUAGE[key];
                printErr && errorLog(`当前选择下，${LANGUAGE_ZH[key]}不支持 \`${foundZhMap(value)}\`，自动替换为默认语种 \`${foundZhMap(map[key])}\``);
            } else {
                map[key] = value;
                printSuc && langs[key] && successLog(`${LANGUAGE_ZH[key]}已成功切换为 \`${foundZhMap(value)}\``);
            }
        } else {
            map[key] = config[key];
            printErr && errorLog(`${LANGUAGE_ZH[key]}无法识别 \`${value}\` 语种，请检查是否输入错误！`);
        }
        config[key] = map[key];
    }
    await writeFile(TLMRC, config);
}

async function setTranslation(name: string, { appid, secretKey }: { appid: string, secretKey: string }) {
    if (await isTranslationPlatformNotFound(name)) return;
    const config = <Tl.Config>await readFile(TLMRC);
    const platform = config.platform[name];
    platform.appid = appid ?? platform.appid;
    platform.key = secretKey ?? platform.key;
    await writeFile(TLMRC, config);
    const plName = await getPlatformName(name);
    successLog(`${plName}翻译平台成功设置应用ID和秘钥`);
}

async function getTranslation(name: string, { show }: { show: boolean }) {
    const { pl, platform } = await getPlatformInfo();
    name = name ?? pl;
    if (await isTranslationPlatformNotFound(name)) return;
    const [_, value] = platform.find(([key]) => key == name)!;
    const prefix = chalk.blue(value.name.split("-")[0] + "翻译");
    const appid = value.appid || "暂未设置";
    const key = value.key ? (show ? value.key : "*".repeat(value.key.length)) : "暂未设置";
    const message = `\n${prefix}\n- 应用ID: ${appid}\n- 秘钥: ${key}`;
    console.log(message);
}

export {
    isTranslationPlatformNotFound,
    languageListHandle,
    showLanguageList,
    showPlatformList,
    changePlatform,
    changeLanguageCode,
    setTranslation,
    getTranslation
}