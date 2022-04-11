import express from "express";
const app = express();
import axios from "axios";
import { parse } from "node-html-parser";
import cron from "node-cron";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const { SENDER, RECIPIENT,
        PROVIDER,
        ID, PW,
        PORT } = process.env;

let oldPrice = null;
let URL = null;
let init = false;

const priceValid = /^\d{1,8}(?:(\.|\,)\d{1,4})?$/;

app.get("/:product/:discount?", async (req, res) => {
    init = true;
    const { product, discount } = req.params;
    const reqURL = `https://amazon.com/dp/${product}`;
    
    const response = await axios.get(reqURL)
                                .then(res => [res.status, res.data])
                                .catch(err => err.status);

    try {
        if (response[0] === 200) {
            const curPrice = parseInt(
                                parse(response[1])
                                .getElementById("priceblock_ourprice")
                                .structuredText
                                .replace(/[^\d\.\,]/g, "")
                            ) || null;

            if (curPrice && priceValid.test(curPrice)) {
                if (!oldPrice && !URL) {
                    URL = reqURL;
                    oldPrice = curPrice;
                }

                if (discount < 100) {
                    curPrice <= (curPrice - ((discount * oldPrice) / 100).toFixed(2)) ? mail(`<b><i>${discount}%</i></b> off`) : null;
                } else {
                    curPrice <= parseInt(oldPrice) ? mail() : null;
                }
            } else {
                throw Error("Could not fetch the product's price.");
            }
        } else {
            throw Error(`Something went wrong (${response}).`);
        }
    } catch (err) {
        return res.status(404).send(err.message);
    }
});

async function mail(msg = "") {
    const mailOptions = {
        from: SENDER,
        to: RECIPIENT,
        subject: "Amazon Price Tracker App",
        html: `<p>The product you requested the tracking of is now ${msg === "" ? "on <b><i>SALE</b></i>" : msg}!</p>`
    };

    const transporter = nodemailer.createTransport({
        service: PROVIDER,
        auth: {
            user: ID,
            pass: PW
        }
    });

    await transporter.sendMail(mailOptions)
                    .then(res => console.log(`E-mailed ${mailOptions.to}.`))
                    .catch(err => console.log(err));
    
    process.on("SIGTERM", () => app.close());
}

if (init) cron.schedule("0 */3 * * *", () => axios.get(URL));

app.listen(PORT || 80);