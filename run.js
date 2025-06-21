import {getDB, initWalgreensDB} from "./index.js";

(async () => {
  await initWalgreensDB();
  const {Users} = await getDB();
  const users = await Users.find().exec();
  console.log(users);
})();
