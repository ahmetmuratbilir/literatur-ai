import fs, { write } from 'fs';//Bu modül dosya okuma ve yazma gibi işlemleri gerçekleştirmek için kullanılır.
import boxPlot from "box-plot"//Box plotlar (kutu grafikleri), veri dağılımlarını görselleştirmek için kullanılan istatistiksel grafiklerdir.
import pkg from 'natural';//Bu kütüphane, metin sınıflandırma, kök bulma
const { BayesClassifier ,WordTokenizer } = pkg;
const tokenizer = new WordTokenizer();

// Specify the file path
const filePath = 'exdata.json';





async function getData(path) {

    var res = fs.readFileSync(path,"utf8");//yani dosya okuma işlemi tamamlanana kadar programın diğer işlemleri durur.
    res = await JSON.parse(res)
    return res

}



async function writeData(datas) {

    const jsonString = JSON.stringify(datas, null, 2);
    fs.writeFileSync("cleardata2.json", jsonString, 'utf-8');

}





async function clear_unuseful_datas(datas) {
    
    var parsed = []
    //İşe yaramayan kolonların silinmesi
    for (let index = 0; index < datas.length; index++) {
        const element = datas[index];
        delete element.link
        delete element["@_fa"]
        // delete element["prism:url"]
        delete element.pubType
        // delete element["prism:teaser"]
        // delete element.eid
        delete element["prism:startingPage"]
        delete element["prism:endingPage"]
        delete element["prism:volume"]
        delete element["articleNumber"]
        delete element["prism:issdeueIntifier"]
        delete element["prism:issueName"]
        delete element["prism:issn"]
        delete element["prism:isbn"]
        delete element["prism:edition"]
        delete element["prism:copyright"]
        delete element["prism:coverDisplayDate"]

        
        delete element.openaccessUserLicense

        const {...rest } = element;
        parsed.push(rest)
    }


    //Veri içeriklerinin düzeltilmesi
    await fix_key_values(parsed)

    

}




async function fix_key_values(datas) {
    
    // var parsed = []


    for (let index = 0; index < datas.length; index++) {
        const element = datas[index];
        
        //@fa cleaned from creator
        element["dc:creator"] = element["dc:creator"][0]["$"]

        //keywords has been splitted with |
        element.authkeywords = element.authkeywords.split("|")
        //keywords has been trimmed
        element.authkeywords = JSON.stringify(element.authkeywords.map(value => value.trim()))//her elemanı trim() fonksiyonuyla boşlukları temizler ve bu temizlenmiş elemanları içeren bir dizi oluşturur. Bu dizi, map() fonksiyonu kullanılarak authkeywords özelliğinin her bir elemanı için oluşturulur.

        element.authors = await JSON.parse(element.authors)
        // element.authors = element.authors.author
        // console.log(element.authors)
        if (element.authors == null) {
            continue
        }
        else{
            var authors = element.authors.author.map(value => value["$"])
            element.authors = JSON.stringify(authors)

        }

    }


    //Birden fazla aynı olan verilerin tespiti ve temizlenmesi
    await clear_duplicate_datas(datas)

}



async function clear_duplicate_datas(datas) {

    // console.log(datas.length,"ow")
    var res = await datas.filter((v,i,a)=>        a.findIndex(v2=>(v2.eid===v.eid))       ===               i   )
    // console.log(res.length)
//Eğer bir öğe (v) veri dizisindeki ilk kez bulunursa, yani dizinin önceki indekslerinde (i) bu öğeyle aynı "eid" özelliğine sahip başka bir öğe yoksa, bu öğe (v) sonuç dizisine (res) eklenir.
    // datas.forEach((element,index) => {
    //     console.log(Object.keys(element).length,index)
    // });


    //Boş değerlerin belirli kurallara göre suni düzeltilmesi
    await fill_empty_values(datas)


}


async function fill_empty_values(datas) {

    var fillwith = {"authors":"dc:creatorr","dc:description":"dc:teaserr","both":"passabstract","prism:coverDisplayDate":"2020"}
    //!var counter = 1

    
    for (let index = 0; index < datas.length; index++) {
        const element = datas[index];

        if (element.authors == null) {
            
            element.authors = element["dc:creator"]
            // counter++
        }
        if (element["dc:description"] == null) {

            element["dc:description"] = element["prism:teaser"]
        }
        if (element["prism:teaser"] == null) {

            element["prism:teaser"] = element["dc:description"]
        }

        if (element["prism:teaser"] == null && element["dc:description"] == null) {

            element["dc:description"] = fillwith.both
            element["prism:teaser"] = fillwith.both

        }



    }



    //Tarih ve saatlerin belirli bir standarta getirilmesi
    await reformat_date_number_etc(datas)




}

async function reformat_date_number_etc(datas) {

    var counter = 0
    for (let index = 0; index < datas.length; index++) {
        const element = datas[index];
        element["available-online-date"] = Number(element["available-online-date"].slice(0,4))
        // console.log(element["available-online-date"],counter++)
    }

    //Suni atıf oluşturma ve enjekte etme
    await citie_spawner(datas)
}


async  function order_in_binary_tree(datas) {
    
    var ordered = {}
    var counter = 0
    for (let index = 0; index < datas.length; index++) {
        const element = datas[index];
        var year = element["available-online-date"]
        if (ordered.hasOwnProperty(year.toString())) {
            ordered[year.toString()].push(element)
        }
        else{
            console.log("new column",year)
            ordered[year.toString()] = []
            ordered[year.toString()].push(element)
        }

        
    }
    console.log(Object.keys(ordered),ordered["2022"].length,ordered["2023"].length)


    writeData(ordered)



}


function basic_analzye_of_data(data_set_to_analyze) {
    



    // var results = boxPlot([1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,3,4,5,6,7,8])

    var results = boxPlot(data_set_to_analyze)


    console.log(results)

    var res1 = results.upperQuartile - results.median
    var res2 = results.median - results.lowerQuartile
    console.log(res1,res2)

    if (results.lowerQuartile == results.median) {
        console.log("veri dağılımı düzensiz")   
        return
    }
    if (results.upperQuartile == results.median) {
        console.log("veri dağılımı düzensiz")
        return
    }
    if (res1>res2) {
        if (res1/res2 > 1.3) {
            console.log("veri dağılımı düzensiz,sağa aşırı çarpık")
            return
        }
    }
    if(res2>res1){
        if (res2/res1 > 1.3) {
            console.log("veri dağılımı düzensiz,sola aşırı çarpık")
            return
        }
    }

    
}




function visualize(params) {

}


async function citie_spawner(datas) {
    for (let index = 0; index < datas.length; index++) {
        
        const element = datas[index];
        var randomNumber = Math.floor(Math.random() * 25001);
        element.citiedby = randomNumber
        
    }
    // writeData(datas),

    //Veri analizi için gerekli verilerin türetilmesi
    await tokenize_and_match(datas)

}




async function tokenize_and_match(datas) {

    for (let index = 0; index < datas.length; index++) {
        var  counter = 0
        const element = datas[index];
        // const vectors =  tokenizer.tokenize(element["dc:description"]);
        const vectors =  tokenizer.tokenize(element["dc:description"]);

        for (let index = 0; index < vectors.length; index++) {
            const element = vectors[index];

            if (element.toLowerCase().includes("bacteria")) {
                counter +=1;
                continue
            }


            
        }
        element.key_count = counter
        if (counter>0) {
            // console.log(counter)
        }

    }

    //AHP anlizinin başlangıcı
    await AHP_point_method(datas)
    // order_in_binary_tree(datas)

}


function year(data) {

    if (data["available-online-date"] <= 2000) {
        data.points.year = 0.15
        return data
    }
    if (data["available-online-date"] > 2000 && data["available-online-date"] <= 2010 ) {
        data.points.year = 0.2
        return data
    }
    if (data["available-online-date"] > 2010 && data["available-online-date"] <= 2020 ) {
        data.points.year = 0.25
        return data
    }
    if (data["available-online-date"] > 2020) {
        data.points.year = 0.4
        return data
    }
}
function key_count(data) {

    if (data.key_count === 0) {
        data.points.key = 0
        return data
    }
    if (data.key_count > 0 && data.key_count <= 2 ) {
        data.points.key = 0.1
        return data
    }
    if (data.key_count > 2 && data.key_count <= 4 ) {
        data.points.key = 0.2
        return data
    }
    if (data.key_count === 5) {
        data.points.key = 0.3
        return data
    }
    if (data.key_count >= 6) {
        data.points.key = 0.4
        return data
    }
}
function citied(data) {
    if (data.citiedby === 0) {
        data.points.citied = 0
        return data
    }
    if (data.citiedby > 0 && data.citiedby <= 100 ) {
        data.points.citied = 0.02
        return data
    }
    if (data.citiedby > 100 && data.citiedby <= 500 ) {
        data.points.citied = 0.03
        return data
    }
    if (data.citiedby > 500 && data.citiedby <= 6000 ) {
        data.points.citied = 0.08
        return data
    }
    if (data.citiedby > 6000 && data.citiedby <= 12000 ) {
        data.points.citied = 0.12
        return data
    }
    if (data.citiedby > 12000 && data.citiedby <= 17000 ) {
        data.points.citied = 0.14
        return data
    }
    if (data.citiedby > 17000 && data.citiedby <= 20000 ) {
        data.points.citied = 0.16
        return data
    }
    if (data.citiedby > 20000 && data.citiedby <= 22000 ) {
        data.points.citied = 0.2
        return data
    }
    if (data.citiedby > 22000 ) {
        data.points.citied = 0.25
        return data
    }
}


function get_points(data) {
    data.points = {year:0,key:0,citied:0}
    //year
    var y1 = year(data)
    //context
    var y2 = key_count(y1)
    //citied
    var y3 = citied(y2)
    return y3
}




async function AHP_point_method(dataset) {
    // Matris
    // 1,1/3,1/4
    // 3,1,1/2
    // 4,2,1
    var weights = {year:0.12,key:0.32,citied:0.56}

    for (let index = 0; index < dataset.length; index++) {
        const element = dataset[index];
        get_points(element)

        var y1 = (weights.year * element.points.year)
        var y2 = (weights.key * element.points.key)
        var y3 = (weights.citied * element.points.citied)
        var t = (y1+y2+y3).toFixed(5)
        // console.log(number(t))

        element.totalPoint = Number(t)

        
    }


    //Belirli bir değişkene göre sıralama
    await sort_asc(dataset)// belirli bir veri kümesini artan sırada (ascending order) sıralamak amacıyla kullanılır.




}


async function sort_asc(datas){

    var sorted = datas.sort(function(a, b) {
        return b.totalPoint - a.totalPoint;
      });
  
    
    //Verilen kaydedilmesi
    await writeData(sorted)
    console.log("\nVeriler puana göre yüksen düşüğe sıralandı\n")

  }


async function final() {
    var res = await getData("cleardata2.json")
    var top10 = res.slice(0,10)


    for (let index = 0; index < top10.length; index++) {
        const element = top10[index];

        console.log(element["dc:title"],"-----",element.totalPoint)//her bir element için başlık (dc:title) ve toplam puanı (totalPoint) konsola yazdırarak bu iki bilginin yan yana görüntülenmesini sağlar.
        
    }
    console.log("\nAHP Puanlama Yöntemine göre en iyi 10 makale, İyi Çalışmalar\n")
}



async function start_for_norm() {
    //Verilerin kaydedilen dosyadan çekilmesi
    var parsedData = await getData(filePath)
    //Ayıklama işleminin başlatılması
    await clear_unuseful_datas(parsedData)
    //Sonuçların yazdırılması
    await final()





}

//Veri analizinin ve temizlenmenin başlatılması
await start_for_norm()