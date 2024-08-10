import MD5 from "crypto-js/md5.js";
import { getPlatformConfig, matchPlatformLanguageCode, errorLog } from "@util/helpers";
import querystring from "querystring";
import fetch from "node-fetch";

export class Baidu implements Tl.Methods {
    private mName: string;
    private mTitle: string;
    constructor(name: string) {
        this.mName = name;
        this.mTitle = "百度翻译";
    }

    async url(query: string[]) {
        const { appid, key, source, target } = await getPlatformConfig(this.mName);
        const langCode = matchPlatformLanguageCode(this.mName, { source, target });
        const salt = Date.now();
        const q = query.join(" ");
        const sign = MD5(appid + q + salt + key).toString();

        const params = querystring.stringify({
            q,
            from: langCode.source,
            to: langCode.target,
            appid,
            salt,
            sign
        });

        return "https://fanyi-api.baidu.com/api/trans/vip/translate?" + params.toString();
    }

    printError(code: string) {
        const messages: { [key: string]: string } = {
            54000: "缺少必填的参数",
            58001: "不支持的语言类型",
            54005: "翻译文本过长",
            52003: "应用ID无效",
            58002: "无相关服务的有效实例",
            90107: "开发者账号无效",
            54001: "签名检验失败，检查KEY和SECRET",
            54004: "账户已经欠费",
            54003: "访问频率受限",
        };

        const message = this.mTitle + ": " + (messages[code] ||
            "请参考错误码：" + code + " [https://api.fanyi.baidu.com/doc/21] ");
        errorLog(message);
    }

    async translate(query: string[]) {
        const url = await this.url(query);
        return fetch(url)
            .then(res => res.json())
            .then((data: any) => {
                const { error_code: ec, trans_result: rs } = data;
                if (ec) {
                    return this.printError(ec);
                } else {
                    return rs[0].dst;
                }
            })
            .catch((err) => console.error(err));
    }
}