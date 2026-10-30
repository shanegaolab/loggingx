package com.loggingx.biz.ai;

import com.loggingx.biz.ai.OpsAssistantService.Attachment;
import com.loggingx.biz.ai.OpsAssistantService.Retrieval;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OpsAssistantPromptTest {

    private static final Retrieval NOTHING = new Retrieval(List.of(), "");

    @Test
    void attachedFilesGoBeforeTheQuestion() {
        String prompt = OpsAssistantService.prompt("为什么报错？", NOTHING, List.of(),
                List.of(new Attachment("app.log", "java.lang.IllegalStateException: stock is negative\n")));

        assertTrue(prompt.contains("## 用户上传的文件\n### app.log\n```\njava.lang.IllegalStateException: "
                + "stock is negative\n```\n"), prompt);
        assertTrue(prompt.indexOf("## 用户上传的文件") < prompt.indexOf("## 问题"), prompt);
    }

    @Test
    void noFilesNoSection() {
        String prompt = OpsAssistantService.prompt("为什么报错？", NOTHING, null, List.of());

        assertFalse(prompt.contains("用户上传的文件"), prompt);
        assertTrue(prompt.contains("（没有找到相关资料）"), prompt);
    }

    @Test
    void unnamedFilesAreLabelled() {
        String prompt = OpsAssistantService.prompt("看看", NOTHING, null, List.of(new Attachment(null, "x")));

        assertTrue(prompt.contains("### 未命名文件\n"), prompt);
    }
}
