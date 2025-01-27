const { PrismaClient } = require("@prisma/client");
const { login } = require("../validations/auth");
const prisma = new PrismaClient();

class Absensi {
  static async getTopicByUser(userId) {
    const data = await prisma.topik.findMany({
      where: {
        userId: userId,
      },
    });
    if (data.length === 0) {
      return "Data not found";
    }
    return data;
  }
  static async getMahasiswaByTopic(trimmedNama, userId) {
    try{
      console.log(trimmedNama, userId, "====> INI USER ID");

    const topic = await prisma.topik.findFirst({
      where: {
        userId,
        ...(trimmedNama && {
          nama: {
            contains: trimmedNama,
            mode: "insensitive",
          },
        }),
      },
      include: {
        topikDetail: {
          select: {
            user_id: true,
            nama: true,
            nim: true,
          },
        },
      },
    });    

    if (!topic || !topic.topikDetail.length) {
      return null;
    }

    const processedDetails = await Promise.all(
      topic.topikDetail.map(async (detail) => {
        const detailLogbooks = await prisma.detailLogbook.findMany({
          where: {
            user_id: detail.user_id,
          },
          include: {
            logbook: true,
          },
        });

        // Calculate attendance counts
        const counts = detailLogbooks.reduce(
          (acc, logbookDetail) => {
            if (!logbookDetail.uploadAt || !logbookDetail.logbook?.tglTerakhir) {
              return acc;
            }

            const uploadAt = new Date(logbookDetail.uploadAt);
            const tglTerakhir = new Date(logbookDetail.logbook.tglTerakhir);
            const izin = logbookDetail.izin?.toLowerCase() === 'true';

            if (uploadAt <= tglTerakhir) {
              acc.hadir++;
            } else if (izin && uploadAt <= tglTerakhir) {
              acc.izin++;
            } else if (izin && uploadAt > tglTerakhir) {
              acc.alpha++;
            } else if (uploadAt > tglTerakhir) {
              acc.alpha++;
            }
            return acc;
          },
          { hadir: 0, izin: 0, alpha: 0 }
        );

        return {
          topikNama: topic.nama,
          topikId: topic.id,
          user_id: detail.user_id,
          nama: detail.nama,
          nim: detail.nim,
          hadir: counts.hadir,
          alpha: counts.alpha,
          izin: counts.izin,
        };
      })
    );

    return processedDetails;
  }catch(err){
    console.log(err);
    return  {
      status: "Failed",
      message: err || err.message + " ini error",
    }
  }
  }
  static async getAttendanceDetails(userId) {
    const detailLogbooks = await prisma.detailLogbook.findMany({
      where: {
        user_id: userId
      },
      select: {
        uploadAt: true,
        logbookId: true,
        izin: true,
        logbook: {
          select: {
            tglTerakhir: true
          }
        }
      }
    });

    if (!detailLogbooks.length) {
      return null;
    }

    

    const processedData = detailLogbooks.map(detail => {
      const uploadAt = new Date(detail.uploadAt);
      const tglTerakhir = new Date(detail.logbook.tglTerakhir);
      const izin = detail.izin?.toLowerCase() === 'true';
      let absensi;

      if (uploadAt <= tglTerakhir) {
      absensi = 'hadir';
      } else if (izin && uploadAt <= tglTerakhir) {
      absensi = 'izin';
      } else if (izin && uploadAt > tglTerakhir) {
      absensi = 'alpha';
      } else if (uploadAt > tglTerakhir) {
      absensi = 'alpha';
      }

      return {
      logbookId: detail.logbookId,
      uploadAt: detail.uploadAt,
      tglTerakhir: detail.logbook.tglTerakhir,
      absensi: absensi
      };
    });
    


    return processedData;
  }
}

module.exports = Absensi;
