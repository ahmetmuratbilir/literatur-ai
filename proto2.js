import { fetch } from "undici";// HTTP istekleri yapmak için kullanılır
import inquirer from 'inquirer';// kullanıcı etkileşimi için kullanılır ve kullanıcıdan girdi almak için çeşitli istemler sağlar.
// import convertEx from "./ex.js";
import { readFile,writeFileSync} from 'fs';

var request_type = "GET"
const api_key = "7f59af901d2d86f78a1fd60c1bf9426a"
var default_page = 0


//warehouse , order picking, storage NOT data warehouse
// warehouse



//Girdileri alma
var context = await inquirer.prompt([
    {
        type: 'input',
        name: 'context',
        message: 'İçerik lütfen ',

    },
    ])

var count = await inquirer.prompt([
    {
        type: 'input',
        name: 'count',
        message: 'Kaç sayfa aramak istersiniz (each page *100)',

    },
    ])


// console.log(context)







function howManyTimes(count) {


    var page = Math.floor(count / 100);

    if (page == 0) {
        return 1
    }else{
        return page + 1
    }



}



async function authorization() {
    //Sonraki requestler için yetkilendirilmiş token
    var resp = await fetch("https://api.elsevier.com/authenticate?choice=55137&platform=SCIDIR&apiKey="+api_key,
    {
   method: request_type,
   headers: {
       "Accept":"application/json",
       "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
   }

})

    if (resp.status !== 200) {

        throw Error("Auth token alınırken bir sıkıntı çıktı")
        
    }
    else{
        console.log(resp.status)
        var res = await resp.json()
        var query = "authenticate-response"
        var token = res[query].authtoken   
        return token
    }

}



async function prepare(token) {
    var raw_listings = []
    try {
        //İlk listelemerin çekilmesi
        var check_data = await get_first_listings(token)//makaleleri çeker tokendaki 
    } catch (error) {
        console.log(error.message)    
        return
    }

    //Verilerin içeriklerinin dışarıya çıkartılması
    console.log(check_data)
    var totalListings = check_data["search-results"]["opensearch:totalResults"]
    totalListings = Number(totalListings)
    var needed = Number(count.count)//kulanıcının girdiği değeri number yapar

    if (totalListings == 0) {
        console.log("Aradığınız kelimeye uygun sonuçlar bulunumadı daha sonra tekrar deneyiniz")
        return
    }

    raw_listings = check_data["search-results"].entry

    //Gelen verinin sayısına göre atılacak olan istek sayılarının belirlenmesi
    if (totalListings < needed*100) {
        console.log(`Sadece ${totalListings} kadar listeleme var bunlar üzerinden aramaya devam edilecek`)

        
        var need = howManyTimes(totalListings)

        console.log("şu kadar arama yapılacak", need)
        console.log("mevcut listings",raw_listings.length)

        try {

        //Belirlenen sayıya göre geri kalan sayfaların çekilmesi
        await get_listings_v1(need,raw_listings,token)
            
        
        } catch (error) {
            console.log(error.message)    
            return
        }

        return

    }
    else{

        console.log("sayı karşılanıyor")

        console.log("şu kadar arama yapılacak", needed)
        console.log("mevcut listings",raw_listings.length)

        try {
            
            await get_listings_v1(needed,raw_listings,token)
            
        } catch (error) {
            console.log(error.msg)    
            return

        }


        return
    }

}



async function get_first_listings(token) {
    // console.log(`https://api.elsevier.com/content/metadata/article?query=key(${context.context})&view=COMPLETE&sort=relevance&count=100&start=${default_page}`)
    var resp = await fetch(`https://api.elsevier.com/content/metadata/article?query=key(${context.context})&view=COMPLETE&sort=relevance&count=100&start=${default_page}`,
        {
       method: request_type,
       headers: {
        "Accept":"application/json",
        "Accept-Encoding":"gzip, deflate, br",
        "Accept-Language":"tr-TR,tr;q=0.6",
        "X-ELS-Authtoken":token,
         "X-ELS-APIKey":api_key,
        "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
    },
       referrer:"https://api.elsevier.com",
       

   })

   if (resp.status !== 200) {
        console.log(await resp.json())
        throw Error("Ilk listeleme alınırken bir sıkıntı çıktı")
    
    }
    else{
        var res = await resp.json()

        return res
    }




}


async function get_listings_v1(how_many_times,raw_listings,token) {
    
    for (let index = 1; index < how_many_times; index++) {//0mi
        console.log("mevcut index",index)

        var resp = await fetch(`https://api.elsevier.com/content/metadata/article?query=key(${context.context})&view=COMPLETE&sort=relevance&count=100&start=${index*100}`,
        {
        method: request_type,
        headers: {
            "Accept":"application/json",
            "Accept-Encoding":"gzip, deflate, br",
            "Accept-Language":"tr-TR,tr;q=0.6",
            "X-ELS-Authtoken":token,
            "X-ELS-APIKey":api_key,
            "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
        },
        referrer:"https://api.elsevier.com",
        

    })

        if (resp.status !== 200) {

            throw Error("Ilk listeleme alınırken bir sıkıntı çıktı")
        
        }
        else{
            var res = await resp.json()

            //Ham Verilerin istiflenmesi
            res["search-results"].entry.forEach(element => {
                raw_listings.push(element)
            });

        }





        
    }






    console.log("son durum",raw_listings.length)

    console.log("example data",raw_listings[0])

    //Ham verilerin belirli bir düzene sokulması
    for (let index = 0; index < raw_listings.length; index++) {
        const element = raw_listings[index];
        raw_listings[index] = {...element,link:JSON.stringify(element.link),authors:JSON.stringify(element.authors)}//json a döüştürür

        
        
    }





    //Verilerin exdata.jsona kaydedilmesi
    const jsonString = JSON.stringify(raw_listings, null, 2);

    // Specify the file path
    const filePath = 'exdata.json';

    console.log("last log")
    // Write the JSON string to a file
    writeFileSync(filePath, jsonString, 'utf-8');



    // convertEx(raw_listings)


    // clear_unuseful_datas(raw_listings)



}


async function results(re) {
    console.log(re)
}



async function start() {
    try {
        //Yetkilendirme aşaması; Token alıyoruz onun sayesinde sayfalardan veri çekebiliyoruz.
        var token = await authorization()
    } catch (error) {
        console.log(error.message)    
        return
    }
    //Ön izlenim veri yapısı kontrolu
    await prepare(token)

}

//Başlangıç
await start()


