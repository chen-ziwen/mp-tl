import sha256 from "crypto-js/sha256.js";
import { getPlatformConfig, matchPlatformLanguageCode, errorLog } from "@util/helpers";
import querystring from "querystring";
import fetch from "node-fetch";

export class Youdao implements Tl.Methods {
    private mName: string;
    private mTitle: string;
    constructor(name: string) {
        this.mName = name;
        this.mTitle = "有道翻译";
    }

    getTruncate(str: string) {
        const len = str.length;
        if (len <= 20) return str;
        return str.slice(0, 10) + len + str.slice(-10);
    }

    async url(query: string[]) {
        const { appid, key, source, target } = await getPlatformConfig(this.mName);
        const langCode = matchPlatformLanguageCode(this.mName, { source, target });
        const salt = Date.now();
        const q = query.join(" ");
        const curtime = Math.round(new Date().getTime() / 1000);
        const sign = sha256(appid + this.getTruncate(q) + salt + curtime + key).toString();

        const params = querystring.stringify({
            q,
            from: langCode.source,
            to: langCode.target,
            appKey: appid,
            salt,
            sign,
            signType: "v3",
            curtime
        });

        return "https://openapi.youdao.com/api?" + params.toString();
    }

    printError(code: string) {
        const messages: { [key: string]: string } = {
            101: "缺少必填的参数",
            102: "不支持的语言类型",
            103: "翻译文本过长",
            108: "应用ID无效",
            110: "无相关服务的有效实例",
            111: "开发者账号无效",
            112: "请求服务无效",
            113: "查询为空",
            202: "签名检验失败，检查KEY和SECRET",
            401: "账户已经欠费",
            411: "访问频率受限",
        };

        const message = this.mTitle + ": " + (messages[code] ||
            "请参考错误码：" + code + " [https://ai.youdao.com/DOCSIRMA/html/trans/api/wbfy/index.html] ");
        errorLog(message);
    }

    async translate(query: string[]) {
        const url = await this.url(query);
        return fetch(url)
            .then(res => res.json())
            .then((data: any) => {
                const { errorCode: ec, translation: tl } = data;
                if (ec !== "0") {
                    return this.printError(ec);
                }
                return tl.join(" ");
            })
            .catch((err) => {
                this.printError(err);
            });
    }
}
