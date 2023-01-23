const http = require("http");
const os = require("os");
const fs = require("fs");
const git = require("simple-git")("C:/Openhaus/Openhaus-Beta");

var isPatch = true;

/* Fetch device IP Address */
const interfaces = os.networkInterfaces();
let ip;
for (const name of Object.keys(interfaces)) {
  for (const interface of interfaces[name]) {
    if (interface.family === "IPv4" && !interface.internal) {
      ip = interface.address;
      break;
    }
  }
}

/* Fetch info */
let jsonString = fs.readFileSync("info.json");
let info = JSON.parse(jsonString);
let currentRelease = info.CurrentRelease;
let currentPatch = info.CurrentPatch;

/* Server */
const server = http.createServer(async (req, res) => {
  if (req.url === "/") {
    res.end("Server running");
  }
  if (req.method === "POST" && req.url === "/trigger") {
    var creds = info.Username + ":" + info.Password;

    var options = {
      hostname: `${ip}`,
      port: 8088,
      path: "/crumbIssuer/api/json",
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + new Buffer.from(creds).toString("base64"),
      },
    };

    /* Fetch tags */
    const tags = await git.tags();
    var latestTag = currentRelease;
    if (tags.latest.toString() + ".0" != currentRelease) {
      isPatch = false;
      latestTag = tags.latest.toString() + ".0";
      info["CurrentRelease"] = latestTag;
      info["CurrentPatch"] = latestTag;
      fs.writeFileSync("info.json", JSON.stringify(info));
    }

    /* Save patch data */
    if (isPatch) {
      var patchNumber = parseInt(currentPatch.split(".")[2]) + 1;
      currentPatch = currentRelease.substr(0, currentRelease.length - 1) + patchNumber.toString();
      info["CurrentPatch"] = currentPatch;
      fs.writeFileSync("info.json", JSON.stringify(info));
    }

    http.get(options, (getRes) => {
      let data = "";

      /* Fetch Jenkins crumbs and cookie */
      getRes.on("data", (chunk) => {
        data += chunk;
      });
      var cookie = getRes.headers["set-cookie"][0];

      getRes.on("end", () => {
        jsonData = JSON.parse(data);

        /* Use crumbs and cookie */
        if (!isPatch) {
          options.path = "/job/OpenhausMVP-ReleaseBuild/buildWithParameters?BuildVersion=" + latestTag;
        } else {
          options.path = "/job/OpenhausMVP-PatchBuild/buildWithParameters?BuildVersion=" + currentPatch + "&BasedVersion=" + latestTag;
        }
        options.method = "POST";
        options.headers = {
          "Content-Type": "application/json",
          Cookie: cookie,
          Authorization: "Basic " + new Buffer.from(creds).toString("base64"),
          [jsonData.crumbRequestField]: jsonData.crumb,
        };

        /* Trigger Jenkins build */
        var postReq = http.request(options, (postRes) => {
          postRes.on("data", (chunk) => {
            console.log(`BODY: ${chunk}`);
          });
        });
        postReq.end();
      });
    });
    if (isPatch) {
      res.end("Patch Build triggered, Version - " + currentPatch);
    } else {
      res.end("Release Build triggered, Version - " + latestTag);
    }
  } else {
    res.statusCode = 404;
    res.end();
  }
});

/* Start server */
server.listen(3000, () => {
  console.log(`Server running at http://${ip}:3000/`);
});

// const http = require("http");
// const os = require("os");
// const git = require("simple-git")("C:/Openhaus/Openhaus-Beta");

// /* Fetch device IP Address */
// const interfaces = os.networkInterfaces();
// let ip;
// for (const name of Object.keys(interfaces)) {
//   for (const interface of interfaces[name]) {
//     if (interface.family === "IPv4" && !interface.internal) {
//       ip = interface.address;
//       break;
//     }
//   }
// }

// /* Server */
// const server = http.createServer((req, res) => {
//   if (req.url === "/") {
//     res.end("Server running");
//   }
//   if (req.method === "POST" && req.url === "/trigger") {
//     var options = {
//       hostname: `${ip}`,
//       port: 8088,
//       path: "/crumbIssuer/api/json",
//       method: "GET",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: "Basic " + new Buffer.from("Openhaus-Dev:Ophs123").toString("base64"),
//       },
//     };

//     http.get(options, async (getRes) => {
//       let data = "";

//       /* Fetch Jenkins crumbs and cookie */
//       getRes.on("data", (chunk) => {
//         data += chunk;
//       });

//       // const tags = await git.tags();
//       // if (tags.latest != null) {
//       //   var latestTag = tags.latest.toString();
//       //   if (latestTag.includes("Release")) {
//       //     var tagVersion = latestTag.substring(7, latestTag.length);
//       //   }
//       // }
//       var cookie = getRes.headers["set-cookie"][0];

//       getRes.on("end", () => {
//         jsonData = JSON.parse(data);

//         /* Use crumbs and cookie */
//         // if (latestTag.includes("Release") && tagVersion != "1.0.0") {
//         //   options.path = "/job/OpenhausMVP-ReleaseBuild/buildWithParameters?BuildVersion=" + tagVersion;
//         // } else {
//         //   options.path = "/job/OpenhausMVP-PatchBuild/buildWithParameters?BuildVersion=" + tagVersion;
//         // }
//         options.path = "/job/OpenhausMVP-PatchBuild/build";
//         options.method = "POST";
//         options.headers = {
//           "Content-Type": "application/json",
//           Cookie: cookie,
//           Authorization: "Basic " + new Buffer.from("Openhaus-Dev:Ophs123").toString("base64"),
//           [jsonData.crumbRequestField]: jsonData.crumb,
//         };

//         /* Trigger Jenkins build */
//         var postReq = http.request(options, (postRes) => {
//           postRes.on("data", (chunk) => {
//             console.log(`BODY: ${chunk}`);
//           });
//         });
//         postReq.end();
//       });
//     });
//     res.end("Build triggered");
//   } else {
//     res.statusCode = 404;
//     res.end();
//   }
// });

// /* Start server */
// server.listen(3000, () => {
//   console.log(`Server running at http://${ip}:3000/`);
// });
